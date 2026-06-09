import { hc } from "hono/client";
import Constants from "expo-constants";
import type { AppType } from "@template/web";
import { getToken } from "./auth";

const baseUrl =
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  process.env.EXPO_PUBLIC_API_URL;

const client = hc<AppType>(baseUrl!, {
  headers: (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

export const api = client.api;
