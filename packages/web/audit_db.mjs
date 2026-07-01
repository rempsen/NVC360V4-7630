import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync("/home/user/nvc360-v4/.env","utf8").split("\n").filter(l=>l.includes("="))
  .map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]})
);
const db = createClient({url:env.DATABASE_URL,authToken:env.DATABASE_AUTH_TOKEN});

// Get all table names
const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log("TABLES:", tables.rows.map(r=>r[0]).join(", "));

// Get bookings columns
const bookingCols = await db.execute("PRAGMA table_info(bookings)");
console.log("\nBOOKINGS COLUMNS:");
bookingCols.rows.forEach(r=>console.log(" ", r[1], r[2]));

// Get riders columns
const riderCols = await db.execute("PRAGMA table_info(riders)");
console.log("\nRIDERS COLUMNS:");
riderCols.rows.forEach(r=>console.log(" ", r[1], r[2]));

// Get users columns
const userCols = await db.execute("PRAGMA table_info(user)");
console.log("\nUSER COLUMNS:");
userCols.rows.forEach(r=>console.log(" ", r[1], r[2]));

// Get company_settings columns
const csCols = await db.execute("PRAGMA table_info(company_settings)");
console.log("\nCOMPANY_SETTINGS COLUMNS:");
csCols.rows.forEach(r=>console.log(" ", r[1], r[2]));

await db.close();
