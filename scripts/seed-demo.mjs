import { format, subDays } from "date-fns";
import { sqlite as db } from "../lib/db/client.ts";
const now = new Date().toISOString();
const add = (id, name, domain, hue, goal, starting, names) => {
  db.prepare("INSERT INTO journey (id,name,domain,hue,start_date,status,created_at) VALUES (?,?,?,?,?,'active',?)").run(id,name,domain,hue,format(subDays(new Date(now), 23), "yyyy-MM-dd"),now);
  db.prepare("INSERT INTO charter (id,journey_id,version,goal,why,done_looks_like,starting_point,created_at) VALUES (?,?,?,?,?,?,?,?)").run(`${id}-goal`,id,1,goal,"A steady private practice.","A confident finish.",starting,now);
  for (const [index, skill] of names.entries()) db.prepare("INSERT INTO skill (id,journey_id,name,level,prereq_ids_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`${id}-${index}`,id,skill,index % 5,"[]",now,now);
  db.prepare("INSERT INTO state_snapshot (id,journey_id,summary,changed_phrases_json,created_at) VALUES (?,?,?,?,?)").run(`${id}-state`,id,starting,"[]",now);
};
db.transaction(() => {
  db.exec("DELETE FROM profile_fact WHERE source_entry_id IN (SELECT id FROM log_entry WHERE journey_id IN ('piano','physics'))");
  db.exec("DELETE FROM skill_event WHERE skill_id IN (SELECT id FROM skill WHERE journey_id IN ('piano','physics'))");
  for (const table of ["entry_time","extraction_answer","log_extraction"]) {
    db.exec(`DELETE FROM ${table} WHERE entry_id IN (SELECT id FROM log_entry WHERE journey_id IN ('piano','physics'))`);
  }
  for (const table of ["review","proposal","plan_item","state_snapshot", "log_entry", "skill", "charter"]) {
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
  const insertEvent=db.prepare("INSERT INTO skill_event VALUES (?,?,?,?,?,?,?)");
  for (const [skill,indices] of [[0,[1,9,14]],[1,[0,8]],[5,[2,7,15]],[11,[10]]]) {
    for(const [step,index] of indices.entries()) {
      const entry=db.prepare("SELECT * FROM log_entry WHERE id=?").get(`piano-entry-${index}`);
      insertEvent.run(`demo-${skill}-${index}`,`piano-${skill}`,entry.id,step+1,1,entry.raw_text,entry.created_at);
      db.prepare("UPDATE skill SET level=?,updated_at=? WHERE id=?").run(step+1,entry.created_at,`piano-${skill}`);
    }
  }
  db.prepare("UPDATE journey SET last_seen_at=? WHERE id='piano'").run(subDays(new Date(now),3).toISOString());

  for(const [index,text] of ["You slow scales down before breakfast.","Separate hands help you work through the jump.","You tap the rhythm before playing.","A metronome helps you return to scales.","You notice when a chord feels automatic.","You try quiet dynamics for contrast."].entries()) {
    db.prepare("INSERT INTO profile_fact VALUES (?,?,'practice',?,'active',?,NULL)").run(`demo-fact-${index}`,text,`piano-entry-${[0,5,3,8,10,11][index]}`,now);
  }
  const review={headline:"Steadier hands, one page at a time.",planned:120,actual:105,
    insights:[{title:"Reading",text:"You returned to the page even when you lost the count."},{title:"Technique",text:"Slow practice gave you time to notice the jump."},{title:"Next week",text:"Keep one short sight-reading block in the plan."}],suggestions:[]};
  db.prepare("INSERT INTO review VALUES (?,?,?,?,?,?)").run("piano-demo-review","piano",format(subDays(new Date(now),13),"yyyy-MM-dd"),format(subDays(new Date(now),7),"yyyy-MM-dd"),JSON.stringify(review),now);
  const plan={title:"Give the left hand time",why:"The jump at bar 12 is still catching you.",blocks:[
    {title:"Warm up with scales",minutes:5,instructions:"Start with one familiar scale.",why:"Settle into the keys.",skill_ids:["piano-1"]},
    {title:"Work on the jump",minutes:20,instructions:"Play the left hand alone at bar 12.",why:"That jump has been catching you.",skill_ids:["piano-0"]},
    {title:"Read the page",minutes:5,instructions:"Read through slowly once.",why:"Notice where the pulse changes.",skill_ids:["piano-5"]}],coming_up:[]};
  db.prepare("INSERT INTO proposal VALUES ('piano-demo-plan','piano','session_plan',?,'applied','demo',?,?)").run(JSON.stringify(plan),now,now);
  db.prepare("INSERT INTO plan_item VALUES ('piano-demo-plan','piano',?,?,?,?,'planned',30,?)").run(format(new Date(now),"yyyy-MM-dd"),plan.title,plan.why,JSON.stringify(plan.blocks),now);

})();
console.log("Seeded Piano and Physics journeys.");
