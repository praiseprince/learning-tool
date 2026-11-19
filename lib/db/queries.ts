import { eq, desc } from "drizzle-orm";
import { db } from "./client";
import { charters, entries, journeys, skills } from "./schema";

export async function getJourney(id: string) { return db.select().from(journeys).where(eq(journeys.id, id)).get(); }
export async function getJourneys() { return db.select().from(journeys).where(eq(journeys.status, "active")).all(); }
export async function getJourneyView(id: string) { const journey = await getJourney(id); if (!journey) return null; return { journey, charter: db.select().from(charters).where(eq(charters.journeyId, id)).orderBy(desc(charters.version)).get(), skills: db.select().from(skills).where(eq(skills.journeyId, id)).all(), entries: db.select().from(entries).where(eq(entries.journeyId, id)).orderBy(desc(entries.occurredOn)).all() }; }
