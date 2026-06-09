import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { api } from "./api";
import { getToken } from "./auth";

/**
 * Expo push notifications for the technician app.
 *
 * Responsibilities:
 *  - Ask for notification permission (once).
 *  - Get the Expo push token and register it with the backend.
 *  - Set up the Android notification channel.
 *  - Handle taps so a job notification deep-links into that job.
 *
 * The token is registered against the logged-in user via
 * POST /api/notifications/push-token and removed on logout.
 */

// How a notification behaves when it arrives while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let cachedToken: string | null = null;

/** Resolve the Expo project id from app config (needed for getExpoPushTokenAsync). */
function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Job alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0ea5e9",
  });
}

/**
 * Request permission + fetch the Expo push token. Returns the token string
 * (ExponentPushToken[...]) or null if unavailable / denied.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (!Device.isDevice) {
    // Push only works on a physical device — simulators can't receive APNs.
    return null;
  }

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;

  try {
    const pid = projectId();
    const res = await Notifications.getExpoPushTokenAsync(
      pid ? { projectId: pid } : undefined,
    );
    cachedToken = res.data;
    return cachedToken;
  } catch {
    return null;
  }
}

/** Register the device's push token with the backend (idempotent). */
export async function registerPushToken(): Promise<void> {
  if (!getToken()) return;
  const token = await getExpoPushToken();
  if (!token) return;
  try {
    await api.notifications["push-token"].$post({
      json: {
        token,
        platform: Platform.OS === "android" ? "android" : "ios",
        deviceName: Device.deviceName ?? "",
      },
    });
  } catch {
    /* transient — will retry next launch */
  }
}

/** Remove this device's token from the backend (call on logout). */
export async function unregisterPushToken(): Promise<void> {
  if (!cachedToken) return;
  try {
    await api.notifications["push-token"].remove.$post({
      json: { token: cachedToken },
    });
  } catch {
    /* ignore */
  }
}

/**
 * Hook: registers the push token once the user is authenticated and wires up
 * tap handling so a job notification routes straight to that job screen.
 */
export function usePushNotifications() {
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    registerPushToken();

    // Cold start: app opened from a notification tap.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const bookingId = response?.notification.request.content.data?.bookingId;
      if (bookingId) router.push(`/job/${bookingId}`);
    });

    // Warm tap: user taps a notification while app is running/backgrounded.
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const bookingId = response.notification.request.content.data?.bookingId;
        if (bookingId) router.push(`/job/${bookingId}`);
      });

    return () => {
      responseListener.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
