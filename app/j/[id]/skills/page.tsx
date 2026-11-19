import Link from "next/link";
import { notFound } from "next/navigation";
import { getJourneyView } from "@/lib/db/queries";
import { SkillRow } from "@/components/marks/skill-stroke";
export const dynamic = "force-dynamic";
export default async function Skills({ params }: PageProps<"/j/[id]/skills">) { const { id } = await params; const view = await getJourneyView(id); if (!view) notFound(); return <main className="journey" style={{ "--hue": view.journey.hue } as React.CSSProperties}><Link className="back-link" href={`/j/${id}`}>Home</Link><h1>Skills</h1><p className="reading">A small map of what you&apos;re learning.</p>{view.skills.map((skill, index) => <SkillRow key={skill.id} name={skill.name} level={skill.level} evidence={index === 0 ? "penciled" : "building"} />)}</main>; }
