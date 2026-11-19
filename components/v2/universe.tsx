"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import dynamic from "next/dynamic";
import {Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import type {ULink, UNode} from "@/lib/v2/universe";
import type {CanvasHandle, Kinds} from "./universe-canvas";
import {Meter} from "./ui";

const Canvas = dynamic(() => import("./universe-canvas"), {ssr: false, loading: () => <div className="loading">Charting your map…</div>});

class Boundary extends Component<{children: ReactNode; fail: () => void}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  componentDidCatch() { this.props.fail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const LEVELS = ["Not started", "Just starting", "Learning", "Working", "Solid", "Fluent"];
const rel = (k: string) => k.replaceAll("_", " ");
type J = {id: string; name: string; hue: number; count: number};
type Route = {node: string; index: number; goal: string};
type Band = "all" | "none" | "learning" | "solid";
const inBand = (b: Band, level: number) => b === "all" || (b === "none" ? level === 0 : b === "learning" ? level >= 1 && level <= 3 : level >= 4);

export function Universe({nodes, links, journeys, route, initialGoal, children}: {nodes: UNode[]; links: ULink[]; journeys: J[]; route: Route[]; initialGoal?: string; children?: ReactNode}) {
  const router = useRouter(), stage = useRef<HTMLDivElement>(null), api = useRef<CanvasHandle>(null), search = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState({w: 0, h: 0}), [theme, setTheme] = useState<"dark" | "light">("light");
  const [query, setQuery] = useState(""), [selected, setSelected] = useState("");
  const [off, setOff] = useState<Set<string>>(() => new Set(initialGoal ? journeys.filter(j => j.id !== initialGoal).map(j => j.id) : []));
  const [list, setList] = useState(false), [rotating, setRotating] = useState(true), [broken, setBroken] = useState(false), [pins, setPins] = useState(0), [live, setLive] = useState("");
  const [band, setBand] = useState<Band>("all"), [kinds, setKinds] = useState<Kinds>({req: true, bridge: true, other: true});
  const [colorBy, setColorBy] = useState<"goal" | "level">("goal"), [labels, setLabels] = useState<"auto" | "all" | "none">("auto"), [showRoute, setShowRoute] = useState(false), [depth, setDepth] = useState(0);

  useEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height)}));
    ro.observe(el); return () => ro.disconnect();
  }, [list]);
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read(); const mo = new MutationObserver(read); mo.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
    return () => mo.disconnect();
  }, []);

  const adj = useMemo(() => { const m = new Map<string, Set<string>>(); for (const l of links) { (m.get(l.source) ?? m.set(l.source, new Set()).get(l.source)!).add(l.target); (m.get(l.target) ?? m.set(l.target, new Set()).get(l.target)!).add(l.source); } return m; }, [links]);
  const reach = useMemo(() => { // nodes within `depth` steps of the selection
    if (!selected || !depth) return null;
    const seen = new Set([selected]); let edge = [selected];
    for (let d = 0; d < depth; d++) { const next: string[] = []; for (const id of edge) for (const o of adj.get(id) ?? []) if (!seen.has(o)) { seen.add(o); next.push(o); } edge = next; }
    return seen;
  }, [selected, depth, adj]);
  const shown = useMemo(() => nodes.filter(n => (!n.journeyId || !off.has(n.journeyId)) && inBand(band, n.level) && (!reach || reach.has(n.id))), [nodes, off, band, reach]);
  const shownJourneys = useMemo(() => journeys.filter(j => !off.has(j.id) && shown.some(n => n.journeyId === j.id)), [journeys, off, shown]);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => q ? shown.filter(n => n.label.toLowerCase().includes(q)) : [], [shown, q]);
  const dim = useMemo(() => q && matches.length ? new Set(matches.map(n => n.id)) : null, [q, matches]);
  const target = nodes.find(n => n.id === selected);
  const related = useMemo(() => links.filter(l => l.source === selected || l.target === selected).map(l => ({link: l, other: nodes.find(n => n.id === (l.source === selected ? l.target : l.source))})), [links, nodes, selected]);
  const visibleRoute = useMemo(() => route.filter(r => !off.has(r.goal)), [route, off]);

  const pick = useCallback((id: string) => { setSelected(id); setQuery(""); setLive(nodes.find(n => n.id === id)?.label ?? ""); setTimeout(() => api.current?.focus(id), 30); }, [nodes]);
  const toggle = (id: string) => setOff(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const asList = list || broken, hasRoute = route.length > 0;
  const open = useCallback((id: string) => router.push("/atlas/n/" + id), [router]);
  const isolate = useCallback((goal: string) => { setOff(new Set(journeys.filter(j => j.id !== goal).map(j => j.id))); setTimeout(() => api.current?.hub(goal), 60); }, [journeys]);

  // keyboard: the map is usable without a mouse
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input,select,textarea")) return;
    const order = [...shown].sort((a, b) => (a.journeyName ?? "").localeCompare(b.journeyName ?? "") || a.label.localeCompare(b.label));
    const i = order.findIndex(n => n.id === selected);
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "]") { e.preventDefault(); const n = order[(i + 1) % order.length]; if (n) pick(n.id); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "[") { e.preventDefault(); const n = order[(i - 1 + order.length) % order.length]; if (n) pick(n.id); }
    else if (e.key === "n" && selected) { const nb = [...(adj.get(selected) ?? [])].map(id => shown.find(x => x.id === id)).filter(Boolean) as UNode[]; if (nb.length) pick(nb.sort((a, b) => b.degree - a.degree)[0].id); }
    else if (e.key === "Enter" && selected) open(selected);
    else if (e.key === "Escape") { setSelected(""); setDepth(0); }
    else if (e.key === "f") api.current?.fit();
    else if (e.key === "l") setLabels(v => v === "auto" ? "all" : v === "all" ? "none" : "auto");
    else if (e.key === "/") { e.preventDefault(); search.current?.focus(); }
  };

  if (!nodes.length) return <div className="page page--read"><h1>Map</h1><div className="empty"><p className="prose">Your map grows from what you learn. Add a goal and its skills appear here.</p><Link className="btn" href="/goals/new">Add a goal</Link></div></div>;

  const kindBtn = (k: keyof Kinds, label: string, cls: string) => <button key={k} aria-pressed={kinds[k]} onClick={() => setKinds(s => ({...s, [k]: !s[k]}))}><i className={"sw " + cls} />{label}</button>;
  return <div className="map" data-open={target ? "" : undefined}>
    <aside className="map-side" aria-label="Map controls">
      <div><h1>Map</h1><p className="count num">{shown.length} skills · {links.filter(l => shown.some(n => n.id === l.source) && shown.some(n => n.id === l.target)).length} links · {shownJourneys.length} {shownJourneys.length === 1 ? "goal" : "goals"}</p></div>
      <label className="field"><span className="sr">Search skills</span><input ref={search} type="search" placeholder="Search skills  ( / )" value={query} onChange={e => setQuery(e.target.value)} /></label>
      {q && <ul className="results" aria-label="Results">{matches.slice(0, 8).map(n => <li key={n.id}><button onClick={() => pick(n.id)}><i className="gm" style={{"--hue": n.hue} as React.CSSProperties} />{n.label}<small>{n.journeyName}</small></button></li>)}{!matches.length && <li className="muted small" style={{padding: 8}}>No skill matches “{query}”.</li>}</ul>}
      {journeys.length > 1 && <div><h2>Goals</h2><ul className="glist">{journeys.map(j => <li key={j.id}><label><input type="checkbox" checked={!off.has(j.id)} onChange={() => toggle(j.id)} /><i className="gm" style={{"--hue": j.hue} as React.CSSProperties} /><span className="gl-n" title={j.name}>{j.name}</span><small className="num">{j.count}</small></label></li>)}</ul></div>}
      <details className="opts" open><summary>View</summary>
        <div className="opt"><span>Show</span><div className="seg-s" role="group" aria-label="Level">{([["all", "All"], ["none", "Not started"], ["learning", "Learning"], ["solid", "Solid"]] as [Band, string][]).map(([v, l]) => <button key={v} aria-pressed={band === v} onClick={() => setBand(v)}>{l}</button>)}</div></div>
        <div className="opt"><span>Colour by</span><div className="seg-s" role="group" aria-label="Colour by">{([["goal", "Goal"], ["level", "Level"]] as const).map(([v, l]) => <button key={v} aria-pressed={colorBy === v} onClick={() => setColorBy(v)}>{l}</button>)}</div></div>
        <div className="opt"><span>Links</span><div className="seg-s seg-s--multi" role="group" aria-label="Links">{kindBtn("req", "Needs first", "sw--req")}{kindBtn("bridge", "Between goals", "sw--bridge")}{kindBtn("other", "Other", "sw--other")}</div></div>
        {hasRoute && <div className="opt"><span>Roadmap</span><div className="seg-s seg-s--multi"><button aria-pressed={showRoute} onClick={() => setShowRoute(v => !v)}>{showRoute ? "Showing the route" : "Show the route"}</button></div></div>}
        {selected && <div className="opt"><span>Focus</span><div className="seg-s" role="group" aria-label="Focus">{([[0, "All"], [1, "1 step"], [2, "2 steps"]] as const).map(([v, l]) => <button key={v} aria-pressed={depth === v} onClick={() => setDepth(v)}>{l}</button>)}</div></div>}
      </details>
      <div className="legend"><h2>Reading the map</h2>
        <p>Bigger dot: more connections. Hollow ring: nothing recorded yet.</p><details className="keys"><summary>Keyboard shortcuts</summary><p className="kbd"><kbd>←</kbd><kbd>→</kbd> next skill · <kbd>N</kbd> neighbour · <kbd>Enter</kbd> open · <kbd>Esc</kbd> clear · <kbd>/</kbd> search · <kbd>F</kbd> fit · <kbd>L</kbd> labels</p></details></div>
      <div className="foot">{children}</div>
    </aside>

    <div className="map-stage" ref={stage} tabIndex={0} onKeyDown={onKey} aria-label="Map. Use arrow keys to move between skills.">
      {asList ? <div className="map-list">{broken && <p className="form-note" role="status">3D graphics aren’t available here, so the list is shown instead.</p>}
        {shownJourneys.map(j => <section key={j.id}><h2><span className="gname"><i className="gm" style={{"--hue": j.hue} as React.CSSProperties} />{j.name}</span></h2>
          <ul className="rows">{shown.filter(n => n.journeyId === j.id).map(n => <li key={n.id}><button className="row" style={{width: "100%", background: "none", border: 0, textAlign: "left", cursor: "pointer"}} onClick={() => setSelected(n.id)}><div><div className="t">{n.label}</div><p className="s">{LEVELS[n.level]}</p></div><Meter level={n.level} /></button></li>)}</ul></section>)}</div>
        : size.w > 0 && <Boundary fail={() => setBroken(true)}><Canvas ref={api} nodes={shown} links={links} journeys={shownJourneys} route={visibleRoute} showRoute={showRoute} width={size.w} height={size.h} theme={theme} colorBy={colorBy} kinds={kinds}
            selected={selected} labels={labels} dim={dim} onSelect={setSelected} onOpen={open} onHub={isolate} onUserMove={() => setRotating(false)} onPins={setPins} /></Boundary>}
      <div className="ctl" role="toolbar" aria-label="View">
        {!asList && <button onClick={() => api.current?.fit()}>Fit</button>}
        {!asList && <button aria-pressed={rotating} onClick={() => { setRotating(!rotating); api.current?.rotate(!rotating); }}>Orbit</button>}
        {!asList && <button onClick={() => setLabels(v => v === "auto" ? "all" : v === "all" ? "none" : "auto")}>Labels: {labels}</button>}
        {!asList && pins > 0 && <button onClick={() => api.current?.unpin()}>Release {pins} pinned</button>}
        {off.size > 0 && <button onClick={() => setOff(new Set())}>Show all goals</button>}
        <button aria-pressed={asList} onClick={() => setList(!list)}>{asList ? "3D" : "List"}</button>
      </div>
      {!asList && <p className="hint">Drag to turn · scroll to zoom · click a dot · double-click to open · drag a dot to pin it</p>}
      <p className="sr" role="status" aria-live="polite">{live ? `Selected ${live}` : ""}</p>
    </div>

    <aside className="map-detail" aria-label="Skill details">{target && <>
      <button className="close" aria-label="Close details" onClick={() => { setSelected(""); setDepth(0); }}>×</button>
      <p className="eyebrow"><span className="gname"><i className="gm" style={{"--hue": target.hue} as React.CSSProperties} />{target.journeyName ?? "No goal"}</span></p>
      <h2>{target.label}</h2>
      <p className="small" style={{display: "flex", gap: 8, alignItems: "center"}}><Meter level={target.level} label={LEVELS[target.level]} /><b>{LEVELS[target.level]}</b></p>
      <p className="muted small">{target.evidence ? `${target.evidence} observation${target.evidence > 1 ? "s" : ""}` : "No evidence yet"}{target.lastSeen ? ` · last ${target.lastSeen.slice(0, 10)}` : ""}</p>
      {target.description && <p className="prose" style={{marginTop: 12}}>{target.description}</p>}
      {related.length > 0 && <><h3>Connected to</h3><ul className="rel">{related.slice(0, 8).map(({link, other}) => other && <li key={link.id}><button onClick={() => pick(other.id)}>{other.label}</button> <span className="muted small">· {rel(link.kind)}</span><p>{link.rationale}</p></li>)}</ul></>}
      <div className="actions" style={{marginTop: 24}}><Link className="btn" href={"/atlas/n/" + target.id}>Open skill</Link>{target.journeyId && <Link className="btn btn--quiet" href={`/?goal=${target.journeyId}`}>Plan a session</Link>}</div></>}</aside>
  </div>;
}
