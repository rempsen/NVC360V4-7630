import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { api } from "./api";
import { getToken } from "./auth";

/**
 * Continuously reports the driver's live GPS location to the backend
 * (PATCH /api/riders/me { lat, lng }) so the dispatch-map pin always reflects
 * the technician's real position — even when the phone is locked or the app is
 * backgrounded.
 *
 * Two layers:
 *  1. Background task (expo-task-manager + Location.startLocationUpdatesAsync)
 *     keeps reporting when the app is not in the foreground. iOS requires the
 *     "Always" location permission + UIBackgroundModes:location for this.
 *  2. Foreground watcher gives tighter, more responsive updates while the tech
 *     has the app open and is looking at the map.
 *
 * Per-job ETA pings still happen separately inside the job screen while enroute.
 */

const BG_TASK = "nvc-location-heartbeat";

/** Shared throttle so background + foreground don't double-spam the API. */
let lastSent = 0;
async function pushLocation(lat: number, lng: number) {
  if (!getToken()) return;
  const now = Date.now();
  if (now - lastSent < 6_000) return; // at most once per 6s
  lastSent = now;
  try {
    await api.riders.me.$patch({ json: { lat, lng } });
  } catch {
    /* offline / transient — next tick retries */
  }
}

// ---- Background task definition (module scope — required by TaskManager) ----
TaskManager.defineTask(BG_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as { locations?: Location.LocationObject[] })?.locations;
  const loc = locs?.[locs.length - 1];
  if (loc) {
    await pushLocation(loc.coords.latitude, loc.coords.longitude);
  }
});

async function startBackgroundUpdates() {
  try {
    // "Always" permission is required for background delivery.
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return false;

    const already = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(
      () => false,
    );
    if (already) return true;

    await Location.startLocationUpdatesAsync(BG_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10_000,
      distanceInterval: 25, // meters
      pausesUpdatesAutomatically: false,
      // Keeps the OS from killing updates; shows the system location banner.
      foregroundService: {
        notificationTitle: "NVC360 is sharing your location",
        notificationBody: "Your live location is visible to dispatch while on shift.",
        notificationColor: "#0ea5e9",
      },
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
    });
    return true;
  } catch {
    return false;
  }
}

async function stopBackgroundUpdates() {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(
      () => false,
    );
    if (started) await Location.stopLocationUpdatesAsync(BG_TASK);
  } catch {
    /* ignore */
  }
}

export function useLocationHeartbeat() {
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const granted = useRef(false);

  async function sendOnce() {
    if (!getToken()) return;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await pushLocation(loc.coords.latitude, loc.coords.longitude);
    } catch {
      /* ignore transient GPS errors */
    }
  }

  async function startForeground() {
    const perm = await Location.getForegroundPermissionsAsync();
    granted.current = perm.granted;
    if (!perm.granted) return;

    // immediate fix so the map jumps to the real position right away
    await sendOnce();

    watcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 6_000,
        distanceInterval: 15,
      },
      (loc) => pushLocation(loc.coords.latitude, loc.coords.longitude),
    );
  }

  function stopForeground() {
    watcher.current?.remove();
    watcher.current = null;
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Kick off background updates first (handles the locked-phone case),
      // then layer the tighter foreground watcher on top while app is open.
      const ok = await startBackgroundUpdates();
      if (!mounted) return;
      granted.current = ok;
      await startForeground();
    })();

    // Refresh a fix whenever the app returns to the foreground.
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active" && granted.current) {
        lastSent = 0; // force an immediate send
        sendOnce();
      }
    });

    return () => {
      mounted = false;
      stopForeground();
      sub.remove();
      // NOTE: we intentionally leave background updates running so the pin keeps
      // moving after the app is backgrounded. They are stopped explicitly on
      // logout / going offline via stopLocationSharing().
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Stop all location sharing — call on logout or when the tech goes offline. */
export async function stopLocationSharing() {
  await stopBackgroundUpdates();
}
