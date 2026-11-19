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

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS log_extraction (
    entry_id TEXT PRIMARY KEY, status TEXT NOT NULL, json TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS proposal (
    id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, kind TEXT NOT NULL, diff_json TEXT NOT NULL,
    status TEXT NOT NULL, source_ref TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT
  );
`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS entry_time (entry_id TEXT PRIMARY KEY, minutes INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS skill_event (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, entry_id TEXT NOT NULL, level_after INTEGER NOT NULL, delta INTEGER NOT NULL, evidence_quote TEXT NOT NULL, at TEXT NOT NULL);`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS extraction_answer (
  entry_id TEXT PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL
)`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS plan_item (
  id TEXT PRIMARY KEY,journey_id TEXT NOT NULL,date TEXT NOT NULL,title TEXT NOT NULL,
  why TEXT NOT NULL,blocks_json TEXT NOT NULL,status TEXT NOT NULL,requested_minutes INTEGER NOT NULL,created_at TEXT NOT NULL
)`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS review (id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, body_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(journey_id,period_start));`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS profile_fact (id TEXT PRIMARY KEY,text TEXT NOT NULL,kind TEXT NOT NULL,source_entry_id TEXT,status TEXT NOT NULL,created_at TEXT NOT NULL,edited_at TEXT);
CREATE TABLE IF NOT EXISTS preference (id INTEGER PRIMARY KEY CHECK(id=1),minutes INTEGER NOT NULL,time_of_day TEXT NOT NULL,week_start INTEGER NOT NULL,theme TEXT NOT NULL);`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS rollup (
 id TEXT PRIMARY KEY,journey_id TEXT NOT NULL,period TEXT NOT NULL,period_start TEXT NOT NULL,summary TEXT NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(journey_id,period,period_start)
);`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS interview (
  id TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0
)`);
