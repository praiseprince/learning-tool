import Link from "next/link";
import { notFound } from "next/navigation";
import { getJourneyView } from "@/lib/db/queries";
export const dynamic = "force-dynamic";
export default async function Goal({ params }: PageProps<"/j/[id]/goal">) { const { id } = await params; const view = await getJourneyView(id); if (!view?.charter) notFound(); const charter = view.charter; return <main className="journey document" style={{ "--hue": view.journey.hue } as React.CSSProperties}><Link className="back-link" href={`/j/${id}`}>Home</Link><h1>Goal</h1>{[["What you want",charter.goal],["Why it matters",charter.why],["What done looks like",charter.doneLooksLike],["Where you started",charter.startingPoint]].map(([heading,copy]) => <section key={heading}><h2>{heading}</h2><p className="reading">{copy}</p></section>)}</main>; }
