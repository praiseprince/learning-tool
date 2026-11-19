import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {requireV2} from "@/lib/v2/access";
import {ensureNotebook} from "@/lib/v2/notebook";
import {ensureRoutes} from "@/lib/v2/route";
import {projection, relationKinds, type Observation} from "@/lib/v2/atlas";
import {LEVELS} from "@/lib/v2/goals";
import {sqlite} from "@/lib/db/client";
import {assessNode, linkNodes} from "../../actions";
import {V2Shell} from "@/components/v2/shell";
import {GoalName, Head, Meter} from "@/components/v2/ui";
import {Select} from "@/components/ui/select";

export default async function Skill({params, searchParams}: PageProps<"/atlas/n/[nodeId]">) {
  requireV2(); ensureNotebook(); ensureRoutes();
  const {nodeId} = await params, query = await searchParams;
  const moved = sqlite.prepare("SELECT target FROM atlas_redirect WHERE source=?").get(nodeId) as {target: string} | undefined;
  if (moved) redirect("/atlas/n/" + moved.target);
  const {nodes, edges} = projection(), node = nodes.find(n => n.id === nodeId);
  if (!node) notFound();
  const goal = sqlite.prepare("SELECT j.id,j.name,j.hue FROM atlas_membership m JOIN journey j ON j.id=m.journey_id WHERE m.node_id=? LIMIT 1").get(nodeId) as {id: string; name: string; hue: number} | undefined;
  const level = node.legacy_id ? (sqlite.prepare("SELECT level FROM skill WHERE id=?").get(node.legacy_id) as {level: number} | undefined)?.level ?? 0 : 0;
  const obs = sqlite.prepare("SELECT * FROM knowledge_observation WHERE node_id=? OR node_id IN (SELECT source FROM atlas_redirect WHERE target=?) ORDER BY observed_at DESC").all(nodeId, nodeId) as Observation[];
  const assessment = sqlite.prepare("SELECT json_extract(after_json,'$.value') AS value FROM graph_event WHERE entity='self_assessment' AND entity_id=? ORDER BY rowid DESC LIMIT 1").get(nodeId) as {value: string} | undefined;
  const notes = sqlite.prepare("SELECT DISTINCT d.id,d.title FROM entity_link l JOIN document d ON d.current_revision_id=l.from_id WHERE l.from_kind='revision' AND l.to_kind='node' AND (l.to_id=? OR l.to_id IN (SELECT source FROM atlas_redirect WHERE target=?))").all(nodeId, nodeId) as {id: string; title: string}[];
  const mine = edges.filter(e => e.source === nodeId || e.target === nodeId);
  const label = (id: string) => nodes.find(n => n.id === id)?.label ?? "";
  const href = (o: Observation) => o.source_kind === "log_entry" && o.journey ? `/goals/${o.journey}?tab=history#e-${o.source_id}`
    : o.source_kind === "document_revision" ? (() => { const r = sqlite.prepare("SELECT document_id FROM document_revision WHERE id=?").get(o.source_id) as {document_id: string} | undefined; return r ? `/notebook/d/${r.document_id}?rev=${o.source_id}` : ""; })()
    : goal ? `/goals/${goal.id}?tab=history` : "";
  return <V2Shell active="Map" hue={goal?.hue} goal={goal?.id}><div className="page page--read">
    <Head back={{href: goal ? `/atlas?goal=${goal.id}` : "/atlas", label: "Map"}} eyebrow={goal ? <GoalName name={goal.name} hue={goal.hue} /> : node.kind} title={node.label} lede={node.description || undefined} />
    <p style={{display: "flex", gap: 12, alignItems: "center"}}><Meter level={level} label={LEVELS[level]} /><b>{LEVELS[level]}</b><span className="muted small">{obs.length ? `${obs.length} observation${obs.length > 1 ? "s" : ""}` : "No evidence yet"}</span></p>

    <section className="section"><h2>Your own view</h2>
      <form action={assessNode.bind(null, nodeId)} className="form" style={{maxWidth: 360}}><label className="field"><span>How well do you feel you know this?</span>
        <Select name="assessment" defaultValue={assessment?.value || "unknown"}>{["unknown", "uncertain", "developing", "comfortable"].map(v => <option key={v}>{v}</option>)}</Select></label>
        <div><button className="btn btn--quiet btn--sm">Save</button></div></form></section>

    <section className="section"><h2>Evidence</h2>
      {obs.length ? <ul className="rows">{obs.map(o => { const h = href(o); return <li key={o.id}><div className="row"><div><blockquote className="quote">“{o.quote}”</blockquote><p className="s">{o.observed_at.slice(0, 10)} · {o.kind.replaceAll("_", " ")}</p></div>{h && <Link className="link small" href={h}>Open source</Link>}</div></li>; })}</ul>
        : <p className="muted">Nothing recorded yet. Log a session or write a note that mentions this skill, and the evidence appears here.</p>}</section>

    {mine.length > 0 && <section className="section"><h2>Connections</h2><ul className="rows">{mine.map(e => { const other = e.source === nodeId ? e.target : e.source; return <li key={e.id}><Link className="row" href={"/atlas/n/" + other}><div><div className="t">{label(other)}</div><p className="s">{e.kind.replaceAll("_", " ")} · {e.rationale}</p></div></Link></li>; })}</ul></section>}

    {notes.length > 0 && <section className="section"><h2>Notes that mention it</h2><ul className="rows">{notes.map(n => <li key={n.id}><Link className="row" href={"/notebook/d/" + n.id}><div className="t">{n.title}</div></Link></li>)}</ul></section>}

    <section className="section"><details open={query.linkError === "1"}><summary className="link">Connect this to another skill</summary>
      {query.linkError && <p className="form-note" role="alert">Check the connection. Duplicate links and circular prerequisites cannot be saved.</p>}
      <form action={linkNodes.bind(null, nodeId)} className="form" style={{marginTop: 16, maxWidth: 480}}>
        <label className="field"><span>Relation</span><Select name="kind">{relationKinds.map(k => <option key={k} value={k}>{k.replaceAll("_", " ")}</option>)}</Select></label>
        <label className="field"><span>To</span><Select name="target">{nodes.filter(n => n.id !== nodeId).map(n => <option value={n.id} key={n.id}>{n.label}</option>)}</Select></label>
        <label className="field"><span>Why are these connected?</span><textarea name="rationale" required maxLength={1000} rows={2} /></label>
        <div><button className="btn btn--quiet btn--sm">Save connection</button></div></form></details></section>
  </div></V2Shell>;
}
