import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import {
  CaretLeft,
  NavigationArrow,
  Phone,
  ChatText,
  MapPin,
  Camera,
  PaperPlaneRight,
  CheckSquare,
  Square,
  User,
  Clock,
  Headset,
  Ruler,
} from "phosphor-react-native";
import { api } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { C, money, fmtDate, assetUrl } from "../../lib/theme";
import { StatusBadge, Button, FullLoader } from "../../components/ui";

const API = ((Constants.expoConfig?.extra?.apiUrl as string) ?? "").replace(/\/$/, "");

// status -> next manual action.
// Arrival & job-start are now automatic via geofence, so the only buttons a
// tech taps are "Start driving" (sends the customer their on-the-way text) and
// "Job Complete" at the end.
const FLOW: Record<string, { next: string; label: string; variant: any }> = {
  assigned: { next: "enroute", label: "Start driving", variant: "primary" },
  enroute: { next: "completed", label: "Complete job", variant: "success" },
  arrived: { next: "completed", label: "Complete job", variant: "success" },
  in_progress: { next: "completed", label: "Complete job", variant: "success" },
};

// states where we keep pinging GPS (drives mileage + geofence auto-arrive/clock)
const ACTIVE_PING = new Set(["enroute", "arrived", "in_progress"]);

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [msg, setMsg] = useState("");
  const [dispatchMsg, setDispatchMsg] = useState("");
  const [uploading, setUploading] = useState(false);

  const job = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const res = await api.bookings[":id"].$get({ param: { id: id! } });
      if (!res.ok) throw new Error("Failed");
      return (await res.json()).booking as any;
    },
    refetchInterval: 15000,
  });

  const messages = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const res = await api.messages[":bookingId"].$get({ param: { bookingId: id! } });
      if (!res.ok) throw new Error("Failed");
      return (await res.json()).messages as any[];
    },
    refetchInterval: 8000,
  });

  const photos = useQuery({
    queryKey: ["photos", id],
    queryFn: async () => {
      const res = await api.bookings[":id"].photos.$get({ param: { id: id! } });
      if (!res.ok) throw new Error("Failed");
      return (await res.json()).photos as any[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await api.bookings[":id"].status.$post({ param: { id: id! }, json: { status } } as any);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", id] }),
  });

  const directThread = useQuery({
    queryKey: ["dispatch-thread"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/messages/direct`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ direct: any[]; job: any }>;
    },
    refetchInterval: 6000,
  });

  const sendMsg = useMutation({
    mutationFn: async (body: string) => {
      const res = await api.messages[":bookingId"].$post({ param: { bookingId: id! }, json: { body } } as any);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      setMsg("");
      qc.invalidateQueries({ queryKey: ["messages", id] });
    },
  });

  const sendDispatch = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`${API}/api/messages/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      setDispatchMsg("");
      qc.invalidateQueries({ queryKey: ["dispatch-thread"] });
    },
  });

  // live location ping while enroute
  useEffect(() => {
    const status = job.data?.status;
    async function startPings() {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const ping = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await fetch(`${API}/api/tracking/${id}/ping`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
          });
        } catch {}
      };
      ping();
      pingTimer.current = setInterval(ping, 8000);
    }
    if (status && ACTIVE_PING.has(status)) startPings();
    return () => {
      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = null;
    };
  }, [job.data?.status, id]);

  const navigate = useCallback(() => {
    const j = job.data;
    if (!j) return;
    const q = j.lat && j.lng ? `${j.lat},${j.lng}` : encodeURIComponent(j.address);
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${q}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    })!;
    Linking.openURL(url);
  }, [job.data]);

  // open native SMS app to text the customer directly (works even if they
  // never opened the tracking link). Optional prefilled body.
  const textCustomer = useCallback(
    (body?: string) => {
      const j = job.data;
      const phone = (j?.customer?.phone || j?.customerPhone || "").replace(/[^\d+]/g, "");
      if (!phone) {
        Alert.alert("No phone number", "This customer has no phone number on file.");
        return;
      }
      const sep = Platform.OS === "ios" ? "&" : "?";
      const url = body
        ? `sms:${phone}${sep}body=${encodeURIComponent(body)}`
        : `sms:${phone}`;
      Linking.openURL(url).catch(() =>
        Alert.alert("Can't open Messages", "No SMS app available on this device."),
      );
    },
    [job.data],
  );

  async function capturePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera needed", "Allow camera to attach job photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.fileName || "job.jpg",
        type: asset.mimeType || "image/jpeg",
      } as any);
      const res = await fetch(`${API}/api/bookings/${id}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      await qc.invalidateQueries({ queryKey: ["photos", id] });
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Try again");
    } finally {
      setUploading(false);
    }
  }

  if (job.isLoading) return <FullLoader />;
  const j = job.data;
  if (!j) return <FullLoader label="Not found" />;

  const action = FLOW[j.status];

  // friendly ETA: "12 min" or "1h 24m"; arrival clock time
  const etaMins: number | null = j.etaMins ?? null;
  const etaLabel =
    etaMins == null
      ? null
      : etaMins >= 60
        ? `${Math.floor(etaMins / 60)}h ${etaMins % 60}m`
        : `${etaMins} min`;
  const arrivalLabel =
    etaMins == null
      ? null
      : new Date(Date.now() + etaMins * 60000).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
  const distLabel = j.etaDistanceKm != null ? `${j.etaDistanceKm} km` : null;
  const etaSmsBody =
    etaLabel != null
      ? `Hi ${j.customer?.name?.split(" ")[0] || "there"}, this is your ${j.service?.name || "service"} technician — I'm on the way, about ${etaLabel} out${arrivalLabel ? ` (arriving ~${arrivalLabel})` : ""}.`
      : `Hi ${j.customer?.name?.split(" ")[0] || "there"}, this is your technician — I'm on the way to you now.`;
  let checklist: any[] = [];
  try { checklist = JSON.parse(j.checklistState || "[]"); } catch {}
  let fields: Record<string, any> = {};
  try { fields = JSON.parse(j.fieldData || "{}"); } catch {}
  const fieldEntries = Object.entries(fields)
    .filter(([k, v]) => v != null && v !== "" && k !== "_customFields");

  // per-unit line items — what the tech is paid by measured unit (cost = tech pay)
  let unitLines: any[] = [];
  try {
    const arr = typeof j.lineItems === "string" ? JSON.parse(j.lineItems || "[]") : j.lineItems;
    if (Array.isArray(arr)) unitLines = arr.filter((x: any) => x?.kind === "unit");
  } catch {}
  const unitPayTotal = unitLines.reduce((sum, l) => sum + (Number(l.cost) || 0), 0);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <CaretLeft color={C.text} size={22} />
        </Pressable>
        <Text style={s.topTitle} numberOfLines={1}>{j.service?.name || j.title || "Job"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.statusRow}>
            <StatusBadge status={j.status} />
            <Text style={s.price}>{money(j.price)}</Text>
          </View>

          {/* Customer */}
          <View style={s.block}>
            <View style={s.custRow}>
              <View style={s.custIcon}><User color={C.brand} size={20} weight="fill" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.custName}>{j.customer?.name || "Customer"}</Text>
                <Text style={s.custMeta}>{fmtDate(j.scheduledAt)}</Text>
              </View>
              {(j.customer?.phone || j.customerPhone) ? (
                <View style={s.contactBtns}>
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${j.customer?.phone || j.customerPhone}`)}
                    style={s.iconBtn}
                  >
                    <Phone color={C.brand} size={19} weight="fill" />
                  </Pressable>
                  <Pressable onPress={() => textCustomer()} style={s.iconBtn}>
                    <ChatText color={C.brand} size={19} weight="fill" />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>

          {/* Address + navigate */}
          <View style={s.block}>
            <View style={s.addrRow}>
              <MapPin color={C.sub} size={18} />
              <Text style={s.addr}>{j.address}</Text>
            </View>
            <Button
              title="Navigate"
              icon={<NavigationArrow color="#04121c" size={18} weight="fill" />}
              onPress={navigate}
              style={{ marginTop: 12 }}
            />
            {j.status === "enroute" && (
              <>
                <View style={s.liveRow}>
                  <View style={s.liveDot} />
                  <Text style={s.liveTxt}>Sharing live location with customer</Text>
                </View>

                {/* Tech's own live ETA — so they can relay it by call/text */}
                <View style={s.etaCard}>
                  <View style={s.etaMain}>
                    <Clock color={C.cyan} size={22} weight="fill" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.etaBig}>
                        {etaLabel ? `${etaLabel} away` : "Calculating ETA…"}
                      </Text>
                      <Text style={s.etaSub}>
                        {arrivalLabel ? `Arriving ~${arrivalLabel}` : "Updates as you drive"}
                        {distLabel ? ` · ${distLabel}` : ""}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => textCustomer(etaSmsBody)} style={s.etaTextBtn}>
                    <ChatText color="#04121c" size={16} weight="fill" />
                    <Text style={s.etaTextBtnTxt}>Text ETA</Text>
                  </Pressable>
                </View>
                <Text style={s.geoHint}>
                  You'll be checked in automatically when you reach the address.
                </Text>
              </>
            )}

            {/* Auto-arrived: geofenced on-site clock */}
            {(j.status === "arrived" || j.status === "in_progress") && (
              <View
                style={[
                  s.clockCard,
                  j.clockState === "paused" && s.clockCardPaused,
                ]}
              >
                <Clock
                  color={j.clockState === "paused" ? C.muted : C.green}
                  size={22}
                  weight="fill"
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.clockBig}>
                    {j.clockState === "paused" ? "Clock paused" : "On site · clock running"}
                  </Text>
                  <Text style={s.clockSub}>
                    {j.clockState === "paused"
                      ? "You've stepped away from the job site — time isn't counting. Return to resume."
                      : `Checked in automatically${
                          typeof j.onSiteMinutes === "number" && j.onSiteMinutes > 0
                            ? ` · ${j.onSiteMinutes} min banked`
                            : ""
                        }`}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Notes */}
          {j.notes ? (
            <View style={s.block}>
              <Text style={s.blockTitle}>Notes</Text>
              <Text style={s.notes}>{j.notes}</Text>
            </View>
          ) : null}

          {/* Job fields */}
          {fieldEntries.length > 0 && (
            <View style={s.block}>
              <Text style={s.blockTitle}>Details</Text>
              {fieldEntries.map(([k, v]) => (
                <View key={k} style={s.fieldRow}>
                  <Text style={s.fieldKey}>{k}</Text>
                  <Text style={s.fieldVal}>{String(v)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Per-unit work & pay (tech-facing — never shown to the client) */}
          {unitLines.length > 0 && (
            <View style={s.block}>
              <View style={s.unitHead}>
                <Ruler color={C.green} size={16} weight="bold" />
                <Text style={s.blockTitle}>Per-unit work &amp; your pay</Text>
              </View>
              {unitLines.map((l, i) => {
                const rate = Number(l.unitCost) || 0; // pay per unit
                const qty = Number(l.qty) || 0;
                const pay = Number(l.cost) || 0;
                return (
                  <View key={l.itemId || i} style={s.unitRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={s.unitName}>{l.name || "Line item"}</Text>
                      <Text style={s.unitMeta}>
                        {qty} {l.unit || "unit"} @ {money(rate)}/{l.unit || "unit"}
                      </Text>
                    </View>
                    <Text style={s.unitPay}>{money(pay)}</Text>
                  </View>
                );
              })}
              <View style={s.unitTotalRow}>
                <Text style={s.unitTotalLabel}>Your pay (per-unit)</Text>
                <Text style={s.unitTotalVal}>{money(unitPayTotal)}</Text>
              </View>
            </View>
          )}

          {/* Checklist */}
          {checklist.length > 0 && (
            <View style={s.block}>
              <Text style={s.blockTitle}>Checklist</Text>
              {checklist.map((item: any, i: number) => {
                const done = typeof item === "object" ? item.done : false;
                const label = typeof item === "object" ? item.label || item.text : String(item);
                return (
                  <View key={i} style={s.checkRow}>
                    {done ? <CheckSquare color={C.green} size={20} weight="fill" /> : <Square color={C.muted} size={20} />}
                    <Text style={[s.checkTxt, done && { color: C.muted, textDecorationLine: "line-through" }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Photos */}
          <View style={s.block}>
            <View style={s.photoHead}>
              <Text style={s.blockTitle}>Photos</Text>
              <Pressable onPress={capturePhoto} style={s.photoBtn} disabled={uploading}>
                {uploading ? <ActivityIndicator color={C.brand} size="small" /> : <Camera color={C.brand} size={18} weight="fill" />}
                <Text style={s.photoBtnTxt}>{uploading ? "Uploading…" : "Add photo"}</Text>
              </Pressable>
            </View>
            {(photos.data?.length ?? 0) > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {photos.data!.map((p) => (
                    <Image key={p.id} source={{ uri: assetUrl(p.url) }} style={s.thumb} />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text style={s.emptyPhoto}>No photos yet. Capture before/after shots.</Text>
            )}
          </View>

          {/* Dispatch Direct Thread */}
          <View style={[s.block, s.dispatchBlock]}>
            <View style={s.dispatchHeader}>
              <Headset color={C.cyan} size={16} weight="fill" />
              <Text style={[s.blockTitle, { color: C.cyan }]}>Dispatch</Text>
              {(directThread.data?.direct ?? []).filter(
                (m: any) => m.senderRole === "dispatch" && !m.read,
              ).length > 0 && (
                <View style={s.unreadBadge}>
                  <Text style={s.unreadTxt}>
                    {(directThread.data?.direct ?? []).filter(
                      (m: any) => m.senderRole === "dispatch" && !m.read,
                    ).length}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ gap: 8, marginTop: 8 }}>
              {(directThread.data?.direct ?? []).length === 0 ? (
                <Text style={s.emptyPhoto}>No messages from dispatch yet.</Text>
              ) : (
                (directThread.data?.direct ?? []).map((m: any) => {
                  const mine = m.senderRole === "tech";
                  return (
                    <View key={m.id} style={[s.bubble, mine ? s.bubbleMine : s.bubbleDispatch]}>
                      {!mine && (
                        <Text style={[s.bubbleName, { color: C.cyan }]}>
                          {m.senderName || "Dispatch"}
                        </Text>
                      )}
                      <Text style={[s.bubbleTxt, mine && { color: "#04121c" }]}>{m.body}</Text>
                      <Text style={s.bubbleTime}>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
            <View style={s.msgInputRow}>
              <TextInput
                value={dispatchMsg}
                onChangeText={setDispatchMsg}
                placeholder="Message dispatch…"
                placeholderTextColor={C.muted}
                style={s.msgInput}
                multiline
              />
              <Pressable
                onPress={() => dispatchMsg.trim() && sendDispatch.mutate(dispatchMsg.trim())}
                style={[s.sendBtn, { backgroundColor: C.cyan }, !dispatchMsg.trim() && { opacity: 0.5 }]}
                disabled={!dispatchMsg.trim() || sendDispatch.isPending}
              >
                {sendDispatch.isPending ? (
                  <ActivityIndicator color="#04121c" size="small" />
                ) : (
                  <PaperPlaneRight color="#04121c" size={18} weight="fill" />
                )}
              </Pressable>
            </View>
          </View>

          {/* Customer Messages */}
          <View style={s.block}>
            <Text style={s.blockTitle}>Customer Messages</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {(messages.data ?? []).length === 0 ? (
                <Text style={s.emptyPhoto}>No messages yet.</Text>
              ) : (
                (messages.data ?? []).map((m) => {
                  const mine = m.senderRole === "tech";
                  return (
                    <View key={m.id} style={[s.bubble, mine ? s.bubbleMine : s.bubbleThem]}>
                      {!mine && <Text style={s.bubbleName}>{m.senderName || m.senderRole}</Text>}
                      <Text style={[s.bubbleTxt, mine && { color: "#04121c" }]}>{m.body}</Text>
                    </View>
                  );
                })
              )}
            </View>
            <View style={s.msgInputRow}>
              <TextInput
                value={msg}
                onChangeText={setMsg}
                placeholder="Message customer…"
                placeholderTextColor={C.muted}
                style={s.msgInput}
                multiline
              />
              <Pressable
                onPress={() => msg.trim() && sendMsg.mutate(msg.trim())}
                style={[s.sendBtn, !msg.trim() && { opacity: 0.5 }]}
                disabled={!msg.trim() || sendMsg.isPending}
              >
                {sendMsg.isPending ? <ActivityIndicator color="#04121c" size="small" /> : <PaperPlaneRight color="#04121c" size={18} weight="fill" />}
              </Pressable>
            </View>
          </View>

          <View style={{ height: 90 }} />
        </ScrollView>

        {/* Sticky action */}
        {action && (
          <View style={s.footer}>
            <Button
              title={action.label}
              variant={action.variant}
              loading={setStatus.isPending}
              onPress={() => {
                if (action.next === "completed") {
                  Alert.alert("Complete job", "Mark this job as completed?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Complete", onPress: () => setStatus.mutate("completed") },
                  ]);
                } else {
                  setStatus.mutate(action.next);
                }
              }}
            />
          </View>
        )}
        {j.status === "completed" && (
          <View style={s.footer}>
            <View style={s.doneBanner}>
              <CheckSquare color={C.green} size={20} weight="fill" />
              <Text style={s.doneTxt}>Job completed · {money(j.price)} earned</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { flex: 1, color: C.text, fontSize: 17, fontWeight: "800", textAlign: "center" },
  scroll: { padding: 16, gap: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { color: C.green, fontSize: 20, fontWeight: "900" },
  block: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  blockTitle: { color: C.sub, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  custRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  custIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.bg3, alignItems: "center", justifyContent: "center" },
  custName: { color: C.text, fontSize: 16, fontWeight: "700" },
  custMeta: { color: C.sub, fontSize: 13, marginTop: 2 },
  contactBtns: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(14,165,233,0.14)", alignItems: "center", justifyContent: "center" },
  etaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    backgroundColor: "rgba(34,211,238,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.25)",
    borderRadius: 14,
    padding: 12,
  },
  etaMain: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  etaBig: { color: C.text, fontSize: 17, fontWeight: "800" },
  etaSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  etaTextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.cyan,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  etaTextBtnTxt: { color: "#04121c", fontSize: 13, fontWeight: "800" },
  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  addr: { color: C.text, fontSize: 15, flex: 1, lineHeight: 21 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.green },
  liveTxt: { color: C.green, fontSize: 12, fontWeight: "600", flex: 1 },
  geoHint: { color: C.sub, fontSize: 12, marginTop: 10, lineHeight: 17 },
  clockCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
  },
  clockCardPaused: {
    backgroundColor: "rgba(148,163,184,0.12)",
    borderColor: "rgba(148,163,184,0.35)",
  },
  clockBig: { color: C.text, fontSize: 15, fontWeight: "800" },
  clockSub: { color: C.sub, fontSize: 12, marginTop: 2, lineHeight: 16 },
  eta: { color: C.cyan, fontSize: 12, fontWeight: "800" },
  notes: { color: C.text, fontSize: 14, lineHeight: 21, marginTop: 8 },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  fieldKey: { color: C.muted, fontSize: 13, textTransform: "capitalize" },
  fieldVal: { color: C.text, fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  unitHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 },
  unitRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  unitName: { color: C.text, fontSize: 14, fontWeight: "700" },
  unitMeta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  unitPay: { color: C.green, fontSize: 15, fontWeight: "800" },
  unitTotalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, marginTop: 2 },
  unitTotalLabel: { color: C.sub, fontSize: 13, fontWeight: "700" },
  unitTotalVal: { color: C.green, fontSize: 17, fontWeight: "900" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  checkTxt: { color: C.text, fontSize: 14, flex: 1 },
  photoHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  photoBtnTxt: { color: C.brand, fontSize: 13, fontWeight: "700" },
  thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: C.bg3 },
  emptyPhoto: { color: C.muted, fontSize: 13, marginTop: 8 },
  bubble: { maxWidth: "82%", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: C.brand, alignSelf: "flex-end" },
  bubbleThem: { backgroundColor: C.bg3, alignSelf: "flex-start" },
  bubbleDispatch: { backgroundColor: "rgba(34,211,238,0.12)", borderWidth: 1, borderColor: "rgba(34,211,238,0.25)", alignSelf: "flex-start" },
  bubbleName: { color: C.sub, fontSize: 11, fontWeight: "700", marginBottom: 2 },
  bubbleTxt: { color: C.text, fontSize: 14, lineHeight: 19 },
  bubbleTime: { color: C.muted, fontSize: 10, marginTop: 3, opacity: 0.7 },
  dispatchBlock: { borderColor: "rgba(34,211,238,0.25)", backgroundColor: "rgba(34,211,238,0.04)" },
  dispatchHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  unreadBadge: { backgroundColor: C.cyan, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, marginLeft: 4 },
  unreadTxt: { color: "#04121c", fontSize: 11, fontWeight: "800" },
  msgInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 12 },
  msgInput: {
    flex: 1,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: C.bg2,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  doneBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  doneTxt: { color: C.green, fontSize: 14, fontWeight: "700" },
});
