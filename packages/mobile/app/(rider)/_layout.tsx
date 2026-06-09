import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import {
  Briefcase,
  CurrencyDollar,
  UserCircle,
  ChatCircleDots,
} from "phosphor-react-native";
import { C } from "../../lib/theme";
import { getToken } from "../../lib/auth";
import { useLocationHeartbeat } from "../../lib/use-location-heartbeat";
import { usePushNotifications } from "../../lib/push";

const API = ((Constants.expoConfig?.extra?.apiUrl as string) ?? "").replace(/\/$/, "");

export default function RiderLayout() {
  // keep the technician's live GPS location flowing to dispatch the whole
  // time they're signed into the driver app (independent of any job).
  useLocationHeartbeat();

  // register this device for push (job offers, enroute alerts) + handle taps.
  usePushNotifications();

  // unread dispatch messages + new job offers → tab badge
  const unread = useQuery({
    queryKey: ["dispatch-unread"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/messages/direct/unread`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return { count: 0 };
      return res.json() as Promise<{ count: number }>;
    },
    refetchInterval: 8000,
  });
  const badge = (unread.data as any)?.count ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.bg2,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 84,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color, focused }) => (
            <Briefcase color={color} size={24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <View>
              <ChatCircleDots color={color} size={24} weight={focused ? "fill" : "regular"} />
              {badge > 0 && (
                <View style={badgeStyles.badge}>
                  <Text style={badgeStyles.badgeTxt}>{badge > 9 ? "9+" : badge}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, focused }) => (
            <CurrencyDollar color={color} size={24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <UserCircle color={color} size={24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
    </Tabs>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -5,
    right: -9,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: C.bg2,
  },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
