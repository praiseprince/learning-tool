import { format, subDays } from "date-fns";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
mkdirSync("data", { recursive: true });
const db = new Database(process.env.DATABASE_URL?.replace(/^file:/, "") || "data/app.db");
const now = new Date().toISOString();
const add = (id, name, domain, hue, goal, starting, names) => {
  db.prepare("INSERT INTO journey (id,name,domain,hue,start_date,status,created_at) VALUES (?,?,?,?,?,'active',?)").run(id,name,domain,hue,format(subDays(new Date(now), 23), "yyyy-MM-dd"),now);
  db.prepare("INSERT INTO charter (id,journey_id,version,goal,why,done_looks_like,starting_point,created_at) VALUES (?,?,?,?,?,?,?,?)").run(`${id}-goal`,id,1,goal,"A steady private practice.","A confident finish.",starting,now);
  for (const [index, skill] of names.entries()) db.prepare("INSERT INTO skill (id,journey_id,name,level,prereq_ids_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`${id}-${index}`,id,skill,index % 5,"[]",now,now);
  db.prepare("INSERT INTO state_snapshot (id,journey_id,summary,changed_phrases_json,created_at) VALUES (?,?,?,?,?)").run(`${id}-state`,id,starting,"[]",now);
};
db.transaction(() => {
  for (const table of ["state_snapshot", "log_entry", "skill", "charter"]) {
    db.prepare(`DELETE FROM ${table} WHERE journey_id IN ('piano','physics')`).run();
  }
  db.prepare("DELETE FROM journey WHERE id IN ('piano','physics')").run();
add("piano","Piano","music",100,"Play a first piece with ease.","Sight-reading is improving, and bar 12 is still the snag.",["Left hand, bar 12","Scales","Finger independence","Pedaling","Dynamics","Sight-reading","Rhythm counting","Key signatures","First piece, bars 1 to 16","First piece, bars 17 to 32","Memorizing","Chord shapes","Intervals by ear","Cadences"]);
add("physics","Physics","science",215,"Understand motion from first principles.","Comfortable with the basics, rebuilding the derivations.",["Momentum","Vectors","Forces","Derivations","Energy","Problem setup"]);
  const notes = {
    piano: ["slow scales before breakfast", "left hand still catching at bar 12", "read through the first page", "tapped the rhythm first", "rest day, wrist sore", "hands separate bars 9–16", "tried pedaling more lightly", "sight reading, lost count twice", "scales with the metronome", "worked on the jump again", "C and G feel automatic now", "quiet dynamics today", "first eight bars from memory", "heard the cadence this time", "left hand alone, then together", "got through the page once"],
    physics: ["read ch 3 on momentum", "drew force diagrams again", "worked through the derivation slowly"]
  };
  const insert = db.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,kind,occurred_on,created_at) VALUES (?,?,?,?,?,?,?)");
  for (const [journey, entries] of Object.entries(notes)) {
    entries.forEach((note, index) => {
      const date = subDays(new Date(now), Math.round((entries.length - index - 1) * 1.5));
      const rest = note.startsWith("rest day");
      insert.run(`${journey}-entry-${index}`, journey, note, rest ? null : [15, 25, 30, 45][index % 4],
        rest ? "rest" : "practice", format(date, "yyyy-MM-dd"), date.toISOString());
    });
  }
})();
console.log("Seeded Piano and Physics journeys.");
