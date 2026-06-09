// Client-safe provider id type (no server/env imports).
export type ProviderId =
  | "quickbooks" | "xero" | "gmail" | "outlook" | "office365"
  | "google_calendar" | "companycam"
  | "google_drive" | "dropbox" | "onedrive";
