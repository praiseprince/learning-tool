import Link from "next/link";
import { notFound } from "next/navigation";
import { getJourneyView } from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { WeekLines } from "@/components/marks/week-lines";
import { Mark } from "@/components/marks/mark";

export const dynamic = "force-dynamic";

export default async function Home({ params }: PageProps<"/j/[id]">) { const { id } = await params; const view = await getJourneyView(id); if (!view) notFound(); const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => ({ label, minutes: index < 3 ? [25, 40, 15][index] : undefined, rest: index === 3, today: index === 4, future: index > 4 })); return <main className="journey" style={{ "--hue": view.journey.hue } as React.CSSProperties}><header className="topbar"><Link href="/new" className="journey-pill"><i />{view.journey.name}</Link><span>Day 1</span></header><section className="home-hero"><h1>Start small, stay close.</h1><p className="reading">A first session gives you somewhere gentle to begin.</p><div className="session-preview"><p><span>0:00</span> Settle in <small>5 min</small></p><p><span>0:05</span> Work one small piece <small>15 min</small></p><p><span>0:20</span> Notice what changed <small>10 min</small></p></div><div className="cluster"><Chip>15</Chip><Chip selected>30</Chip><Chip>60</Chip><Chip>Other</Chip></div><Button>Start session</Button></section><section><h2>This week</h2><WeekLines days={days} plannedMinutes={30} /></section><section><h2>Where you are</h2><p className="reading"><Mark deep>{view.charter?.startingPoint || "Starting from where you are today."}</Mark></p><small>Updated today</small></section><section><h2>Skills</h2><p className="reading-small">{view.skills.length} skills ready to take shape.</p><Link className="text-link" href={`/j/${id}/skills`}>See skills</Link></section></main>; }
