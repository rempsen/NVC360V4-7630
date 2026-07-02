import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const isWeb = Platform.OS === "web";
const TOKEN_KEY = "bearer_token";

export type Role =
  | "customer"
  | "rider"
  | "admin"
  | "manager"
  | "dispatcher"
  | "project_manager";

const baseURL =
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  process.env.EXPO_PUBLIC_API_URL;

export function getToken(): string {
  try {
    return SecureStore.getItem(TOKEN_KEY) ?? "";
  } catch {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  }
}

function setToken(token: string) {
  try {
    SecureStore.setItem(TOKEN_KEY, token);
  } catch {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

async function removeToken() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Capture a rotated/renewed bearer token from the `set-auth-token` response
 * header. better-auth's bearer plugin re-issues this header on ANY
 * authenticated request whenever the underlying session is refreshed
 * server-side (see session updateAge/expiresIn rotation in better-auth's
 * /get-session handler) — not just on sign-in.
 */
export function captureToken(ctx: { response: Response }) {
  const token = ctx.response.headers.get("set-auth-token");
  if (token) setToken(token);
}

export const authClient = createAuthClient({
  baseURL,
  basePath: "/api/auth",
  plugins: [inferAdditionalFields({ user: { role: { type: "string" }, phone: { type: "string" } } })],
  fetchOptions: {
    ...(isWeb ? { credentials: "omit" as const } : {}),
    auth: {
      type: "Bearer",
      token: () => getToken(),
    },
    headers: isWeb ? {} : { "expo-origin": "homeserve://" },
    // BUG FIX: captureToken was previously wired ONLY as a one-off onSuccess
    // callback on the sign-in call (app/sign-in.tsx). That means the very
    // first token was stored fine, but any LATER rotation of the session
    // token — which better-auth issues transparently on ~every request as
    // the session approaches its updateAge window, and especially on the
    // /get-session refetch that fires when the app returns from background
    // (via @better-auth/expo's AppState-driven focus manager) — was silently
    // dropped. The client kept sending the stale old token forever, so the
    // first background/foreground cycle after a silent rotation got a 401
    // and bounced the driver to the sign-in screen with no way to recover
    // short of logging in again. Capturing on EVERY response fixes this.
    onSuccess: isWeb ? undefined : captureToken,
  },
});

export async function clearToken() {
  await removeToken();
}

