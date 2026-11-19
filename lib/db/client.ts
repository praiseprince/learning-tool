import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const databasePath = process.env.DATABASE_URL?.replace("file:", "") || "./data/app.db";
mkdirSync(dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`CREATE TABLE IF NOT EXISTS journey (id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT NOT NULL, hue INTEGER NOT NULL, start_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', last_seen_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS charter (id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, version INTEGER NOT NULL, goal TEXT NOT NULL, why TEXT NOT NULL, done_looks_like TEXT NOT NULL, deadline TEXT, constraints TEXT, starting_point TEXT, note TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS skill (id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, parent_id TEXT, name TEXT NOT NULL, description TEXT, level INTEGER NOT NULL, prereq_ids_json TEXT NOT NULL DEFAULT '[]', archived INTEGER NOT NULL DEFAULT 0, user_edited_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS log_entry (id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, raw_text TEXT NOT NULL, minutes INTEGER, energy TEXT, mood TEXT, kind TEXT NOT NULL, occurred_on TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS state_snapshot (id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, summary TEXT NOT NULL, changed_phrases_json TEXT NOT NULL DEFAULT '[]', source_entry_id TEXT, user_edited_at TEXT, created_at TEXT NOT NULL);`);
export const db = drizzle(sqlite);
export { sqlite };
