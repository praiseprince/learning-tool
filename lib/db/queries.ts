import { eq, desc } from "drizzle-orm";
import { db, sqlite } from "./client";
import { charters, entries, journeys, skills } from "./schema";

export async function getJourney(id: string) { return db.select().from(journeys).where(eq(journeys.id, id)).get(); }
export async function getJourneys() { return db.select().from(journeys).where(eq(journeys.status, "active")).all(); }
export async function getJourneyView(id: string) { const journey = await getJourney(id); if (!journey) return null; const times = new Map((sqlite.prepare("SELECT t.entry_id,t.minutes FROM entry_time t JOIN log_entry e ON e.id=t.entry_id WHERE e.journey_id=?").all(id) as {entry_id:string;minutes:number}[]).map(row=>[row.entry_id,row.minutes]));
const state = sqlite.prepare("SELECT summary FROM state_snapshot WHERE journey_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1").get(id) as {summary:string}|undefined;
return { journey, state, charter: db.select().from(charters).where(eq(charters.journeyId, id)).orderBy(desc(charters.version)).get(), skills: db.select().from(skills).where(eq(skills.journeyId, id)).all(), entries: db.select().from(entries).where(eq(entries.journeyId, id)).orderBy(desc(entries.occurredOn)).all().map(row=>({...row,minutes:times.get(row.id)??row.minutes})) }; }
