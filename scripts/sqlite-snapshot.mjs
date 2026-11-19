import Database from "better-sqlite3";
import { link, mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const [operation, input, output] = process.argv.slice(2);
if (!["backup", "restore"].includes(operation) || !input || !output) {
  throw new Error("Usage: node scripts/sqlite-snapshot.mjs backup|restore source.db new-file.db");
}
const destination = resolve(output);
const temporary = await mkdtemp(join(dirname(destination), ".snapshot-"));
try {
  const snapshot = join(temporary, "verified.db");
  const source = new Database(input, { readonly: true, fileMustExist: true });
  try { await source.backup(snapshot); } finally { source.close(); }
  const check = new Database(snapshot, { readonly: true });
  try {
    if (check.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("Invalid snapshot");
  } finally { check.close(); }
  // Publish only a complete snapshot. An existing destination fails atomically.
  await link(snapshot, destination);
  console.log(`Verified ${operation} written to ${destination}`);
} finally { await rm(temporary, { recursive: true, force: true }); }
