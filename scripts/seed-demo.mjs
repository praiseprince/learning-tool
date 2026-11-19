import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
mkdirSync("data", { recursive: true });
const db = new Database("data/app.db");
db.exec(`DELETE FROM state_snapshot; DELETE FROM log_entry; DELETE FROM skill; DELETE FROM charter; DELETE FROM journey;`);
const now = new Date().toISOString();
const add = (id, name, domain, hue, goal, starting, names) => {
  db.prepare("INSERT INTO journey (id,name,domain,hue,start_date,status,created_at) VALUES (?,?,?,?,?,'active',?)").run(id,name,domain,hue,"2026-10-26",now);
  db.prepare("INSERT INTO charter (id,journey_id,version,goal,why,done_looks_like,starting_point,created_at) VALUES (?,?,?,?,?,?,?,?)").run(`${id}-goal`,id,1,goal,"A steady private practice.","A confident finish.",starting,now);
  for (const [index, skill] of names.entries()) db.prepare("INSERT INTO skill (id,journey_id,name,level,prereq_ids_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`${id}-${index}`,id,skill,index % 5,"[]",now,now);
  db.prepare("INSERT INTO state_snapshot (id,journey_id,summary,changed_phrases_json,created_at) VALUES (?,?,?,?,?)").run(`${id}-state`,id,starting,"[]",now);
};
add("piano","Piano","music",100,"Play a first piece with ease.","Sight-reading is improving, and bar 12 is still the snag.",["Left hand, bar 12","Scales","Finger independence","Pedaling","Dynamics","Sight-reading","Rhythm counting","Key signatures","First piece, bars 1 to 16","First piece, bars 17 to 32","Memorizing","Chord shapes","Intervals by ear","Cadences"]);
add("physics","Physics","science",215,"Understand motion from first principles.","Comfortable with the basics, rebuilding the derivations.",["Momentum","Vectors","Forces","Derivations","Energy","Problem setup"]);
console.log("Seeded Piano and Physics journeys.");
