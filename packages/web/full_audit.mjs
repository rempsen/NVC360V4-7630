import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync("/home/user/nvc360-v4/.env","utf8").split("\n").filter(l=>l.includes("="))
  .map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]})
);
const db = createClient({url:env.DATABASE_URL,authToken:env.DATABASE_AUTH_TOKEN});

const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map(r=>r[0]);

for (const table of tables) {
  if (table.startsWith("__") || table === "sqlite_sequence") continue;
  try {
    const cols = await db.execute(`PRAGMA table_info(${table})`);
    const colNames = cols.rows.map(r=>r[1]);
    // check for camelCase columns (schema migration bug)
    const camelCols = colNames.filter(c => /[A-Z]/.test(String(c)));
    if (camelCols.length > 0) {
      console.log(`TABLE ${table} has camelCase columns (BUG): ${camelCols.join(", ")}`);
    }
  } catch(e) { console.log(`ERROR on ${table}: ${e.message}`); }
}

// Check job_photos for caption column (schema expects it)
const jpCols = await db.execute("PRAGMA table_info(job_photos)");
console.log("\nJOB_PHOTOS COLUMNS:", jpCols.rows.map(r=>r[1]).join(", "));

// Check messages for senderRole column
const msgCols = await db.execute("PRAGMA table_info(messages)");
console.log("\nMESSAGES COLUMNS:", msgCols.rows.map(r=>r[1]).join(", "));

// Check notification_channels
const ncCols = await db.execute("PRAGMA table_info(notification_channels)");
console.log("\nNOTIFICATION_CHANNELS COLUMNS:", ncCols.rows.map(r=>r[1]).join(", "));

// Check tenant_email_domains
const tedCols = await db.execute("PRAGMA table_info(tenant_email_domains)");
console.log("\nTENANT_EMAIL_DOMAINS COLUMNS:", tedCols.rows.map(r=>r[1]).join(", "));

await db.close();
