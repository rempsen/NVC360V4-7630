/**
 * Object storage abstraction.
 *
 * Uses S3 (creds in env) when configured, else falls back to local disk for
 * dev. Call sites don't care which — they get back a stable URL. Local disk is
 * ephemeral and must NOT be used in production (logged as a warning at boot).
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { log } from "./logger";

const S3_BUCKET = process.env.S3_BUCKET;
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION ?? "auto";
const S3_PUBLIC_BASE = process.env.S3_PUBLIC_BASE_URL; // optional CDN/base for public URLs
const USE_S3 = Boolean(
  S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
);

const LOCAL_DIR = join(process.cwd(), "uploads");

let s3: S3Client | null = null;
function client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      forcePathStyle: Boolean(S3_ENDPOINT), // needed for R2/MinIO-style endpoints
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3;
}

if (!USE_S3) {
  log.warn("storage: S3 not configured — using EPHEMERAL local disk (dev only)", {
    hint: "set S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY for production",
  });
}

export interface StoredObject {
  key: string;
  /** URL clients use to fetch the object */
  url: string;
}

/** Persist a buffer. Returns the storage key + a fetch URL. */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<StoredObject> {
  if (USE_S3) {
    await client().send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const url = S3_PUBLIC_BASE
      ? `${S3_PUBLIC_BASE.replace(/\/$/, "")}/${key}`
      : `/api/public/file/${encodeURIComponent(key)}`; // public proxy route
    return { key, url };
  }
  // local fallback
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(join(LOCAL_DIR, key.replace(/\//g, "_")), Buffer.from(body));
  return { key, url: `/uploads/${key.replace(/\//g, "_")}` };
}

/** Remove an object by key. */
export async function deleteObject(key: string): Promise<void> {
  if (USE_S3) {
    await client()
      .send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      .catch(() => {});
    return;
  }
  await unlink(join(LOCAL_DIR, key.replace(/\//g, "_"))).catch(() => {});
}

/** Time-limited signed GET URL (S3 only). Returns null on local fallback. */
export async function signedGetUrl(key: string, expiresIn = 300): Promise<string | null> {
  if (!USE_S3) return null;
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn },
  );
}

/**
 * Fetch an object's bytes for streaming through our own server (public proxy).
 * Works for both S3 and local fallback. Returns null if the object is missing.
 * Used by the public `/api/public/file/:key` route so that <img> tags and
 * outbound email logos load WITHOUT a session — while the underlying bucket
 * can stay private.
 */
export async function getObjectBody(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  if (USE_S3) {
    try {
      const out = await client().send(
        new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      );
      const bytes = await out.Body!.transformToByteArray();
      return {
        body: bytes,
        contentType: out.ContentType || "application/octet-stream",
      };
    } catch {
      return null;
    }
  }
  // local fallback
  const file = Bun.file(join(LOCAL_DIR, key.replace(/\//g, "_")));
  if (!(await file.exists())) return null;
  return {
    body: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type || "application/octet-stream",
  };
}

export const storageMode = USE_S3 ? "s3" : "local";
