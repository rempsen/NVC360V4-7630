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
  },
});

export function captureToken(ctx: { response: Response }) {
  const token = ctx.response.headers.get("set-auth-token");
  if (token) setToken(token);
}

export async function clearToken() {
  await removeToken();
}
