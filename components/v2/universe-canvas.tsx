"use client";
import {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from "react";
import ForceGraph3D from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import {CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, NormalBlending, Sprite, SpriteMaterial, SphereGeometry} from "three";
import type {ULink, UNode} from "@/lib/v2/universe";

export type GNode = UNode & {hub?: boolean; val: number; route?: number; x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number};
export type GLink = {id: string; source: string | GNode; target: string | GNode; kind: string; virtual?: boolean; route?: boolean};
export type CanvasHandle = {fit: () => void; focus: (id: string) => void; rotate: (on: boolean) => void; unpin: () => void; hub: (goal: string) => void};
export type Kinds = {req: boolean; bridge: boolean; other: boolean};
type Props = {
  nodes: UNode[]; links: ULink[]; journeys: {id: string; name: string; hue: number}[]; route: {node: string; index: number; goal: string}[]; showRoute: boolean;
  width: number; height: number; theme: "dark" | "light"; colorBy: "goal" | "level"; kinds: Kinds; selected: string; labels: "auto" | "all" | "none"; dim: Set<string> | null;
  onSelect: (id: string) => void; onOpen: (id: string) => void; onHub: (goal: string) => void; onUserMove: () => void; onPins: (n: number) => void;
};
const LEVELS = ["Not started", "Just starting", "Learning", "Working", "Solid", "Fluent"];

const col = (hue: number, l: number, s = .62) => new Color().setHSL((hue % 360) / 360, s, l);
let glowTex: CanvasTexture | null = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!, grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(.35, "rgba(255,255,255,.4)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return (glowTex = new CanvasTexture(c));
}
type Part = {group: Group; core: MeshBasicMaterial; halo: SpriteMaterial; ring: Sprite; pin: Sprite; label: SpriteText; hub: boolean;
  tCore: number; tHalo: number; tLabel: number; baseHalo: number};

const UniverseCanvas = forwardRef<CanvasHandle, Props>(function UniverseCanvas(p, ref) {
  const fg = useRef<any>(undefined); // eslint-disable-line @typescript-eslint/no-explicit-any
  const parts = useRef(new Map<string, Part>()), raf = useRef(0), pinned = useRef(new Set<string>()), last = useRef({id: "", t: 0});
  const wrap = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<GNode | null>(null), [hover, setHover] = useState("");
  const light = p.theme !== "dark";

  const data = useMemo(() => {
    const ids = new Set(p.nodes.map(n => n.id)), rIdx = new Map(p.route.map(r => [r.node, r.index]));
    const nodes: GNode[] = p.nodes.map(n => ({...n, val: 1 + Math.min(n.degree, 8) * .5 + n.level * .35, route: p.showRoute ? rIdx.get(n.id) : undefined}));
    const links: GLink[] = p.links.filter(l => ids.has(l.source) && ids.has(l.target)).map(l => ({...l}));
    for (const j of p.journeys) {
      const members = p.nodes.filter(n => n.journeyId === j.id); if (!members.length) continue;
      nodes.push({id: "hub:" + j.id, label: j.name, kind: "journey", description: "", origin: "", journeyId: j.id, journeyName: j.name, hue: j.hue, level: 5, evidence: 0, lastSeen: null, degree: members.length, hub: true, val: 5});
      for (const m of members) links.push({id: `v:${j.id}:${m.id}`, source: "hub:" + j.id, target: m.id, kind: "member", virtual: true});
    }
    if (p.showRoute) for (const g of new Set(p.route.map(r => r.goal))) {
      const steps = p.route.filter(r => r.goal === g && ids.has(r.node)).sort((a, b) => a.index - b.index);
      for (let i = 1; i < steps.length; i++) if (steps[i - 1].node !== steps[i].node) links.push({id: `r:${g}:${i}`, source: steps[i - 1].node, target: steps[i].node, kind: "route", route: true});
    }
    const adj = new Map<string, Set<string>>(), add = (a: string, b: string) => { (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b); };
    for (const l of links) { if (l.virtual) continue; const s = typeof l.source === "string" ? l.source : l.source.id, t = typeof l.target === "string" ? l.target : l.target.id; add(s, t); add(t, s); }
    return {nodes, links, adj};
  }, [p.nodes, p.links, p.journeys, p.route, p.showRoute]);

  // objects are rebuilt only when how they look changes, never on hover or selection
  const look = p.theme + p.colorBy + p.showRoute;
  useMemo(() => { parts.current.clear(); void look; }, [look]);
  const build = useCallback((n: GNode) => {
    const group = new Group(), lvl = n.hub ? 5 : n.level, byLevel = p.colorBy === "level" && !n.hub;
    const color = byLevel ? col(168, light ? .86 - lvl * .09 : .3 + lvl * .1, light ? .45 : .5) : col(n.hue, light ? (n.hub ? .4 : .5) : (n.hub ? .72 : .62), .62);
    const radius = n.hub ? 8 : 3.2 + Math.min(n.degree, 8) * .5 + lvl * .3, hollow = !n.hub && n.evidence === 0 && lvl === 0;
    const core = new MeshBasicMaterial({color: hollow ? new Color(light ? "#ffffff" : "#0b0e0d") : color, transparent: true});
    const mesh = new Mesh(new SphereGeometry(radius, 14, 14), core); group.add(mesh);
    if (hollow) { const rim = new Mesh(new SphereGeometry(radius * 1.12, 14, 14), new MeshBasicMaterial({color, transparent: true, opacity: .9, depthWrite: false})); rim.renderOrder = -1; group.add(rim); }
    if (n.kind === "topic") mesh.geometry = new SphereGeometry(radius * 1.2, 6, 4); else if (n.kind === "question") mesh.geometry = new SphereGeometry(radius * .9, 4, 2);
    const baseHalo = n.hub ? .2 : Math.min(.3, .06 + lvl * .04 + n.evidence * .015);
    const halo = new SpriteMaterial({map: glow(), color, blending: NormalBlending, depthWrite: false, transparent: true, opacity: baseHalo});
    const haloSprite = new Sprite(halo); haloSprite.scale.setScalar(radius * (n.hub ? 5 : 3.6)); group.add(haloSprite);
    const ring = new Sprite(new SpriteMaterial({map: glow(), color: new Color(light ? "#0f1211" : "#ffffff"), depthWrite: false, transparent: true, opacity: .5})); ring.scale.setScalar(radius * 6); ring.visible = false; group.add(ring);
    const pin = new Sprite(new SpriteMaterial({map: glow(), color: new Color("#d4430e"), depthWrite: false, transparent: true, opacity: 1})); pin.scale.setScalar(radius * 1.6); pin.position.set(radius * .9, radius * .9, 0); pin.visible = pinned.current.has(n.id); group.add(pin);
    const label = new SpriteText(n.label, n.hub ? 10 : 6, light ? "#0f1211" : "#edf0ec");
    label.fontFace = "Instrument Sans, system-ui, sans-serif"; label.fontWeight = n.hub ? "700" : "500";
    label.material.depthWrite = false; label.material.depthTest = false; label.renderOrder = 20; label.backgroundColor = light ? "rgba(243,244,241,.9)" : "rgba(11,14,13,.88)"; label.padding = n.hub ? 2.2 : 1.4; label.borderRadius = 2;
    label.position.y = radius + (n.hub ? 14 : 8); label.visible = !!n.hub; group.add(label);
    if (n.route !== undefined) { const b = new SpriteText(String(n.route + 1), 7, "#ffffff"); b.backgroundColor = "#d4430e"; b.padding = 2; b.borderRadius = 6; b.material.depthTest = false; b.renderOrder = 30; b.position.set(-radius - 4, radius + 4, 0); group.add(b); }
    parts.current.set(n.id, {group, core, halo, ring, pin, label, hub: !!n.hub, tCore: 1, tHalo: baseHalo, tLabel: n.hub ? 1 : 0, baseHalo});
    return group;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look, light]);

  // ease every material toward its target so highlight and dimming glide instead of snapping
  const kick = useCallback(() => {
    if (raf.current) return;
    const tick = () => {
      let busy = false;
      for (const x of parts.current.values()) {
        const lm = x.label.material as SpriteMaterial, dc = x.tCore - x.core.opacity, dh = x.tHalo - x.halo.opacity, dl = x.tLabel - lm.opacity;
        if (Math.abs(dc) > .01) { x.core.opacity += dc * .28; busy = true; } else x.core.opacity = x.tCore;
        if (Math.abs(dh) > .005) { x.halo.opacity += dh * .28; busy = true; } else x.halo.opacity = x.tHalo;
        if (Math.abs(dl) > .01) { lm.opacity += dl * .3; busy = true; } else lm.opacity = x.tLabel;
        x.label.visible = lm.opacity > .02;
      }
      raf.current = busy ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // targets: what is highlighted, faded and labelled
  useEffect(() => {
    const focusId = hover || p.selected, near = new Set<string>();
    if (focusId) { near.add(focusId); for (const x of data.adj.get(focusId) ?? []) near.add(x); }
    for (const [id, x] of parts.current) {
      const hub = id.startsWith("hub:"), inNear = near.has(id), match = p.dim ? p.dim.has(id) : true;
      const faded = hub ? false : (focusId ? !inNear : false) || !match;
      x.tCore = faded ? .16 : 1; x.tHalo = faded ? x.baseHalo * .15 : (inNear && focusId ? Math.min(.5, x.baseHalo * 2.2) : x.baseHalo);
      x.tLabel = hub ? (focusId && !inNear ? .35 : 1) : faded ? 0 : (p.labels === "all" || (p.labels === "auto" && data.nodes.length <= 46) || (focusId ? inNear : false) || (!!p.dim && p.dim.has(id))) && p.labels !== "none" || (!!focusId && inNear) ? 1 : 0;
      x.ring.visible = id === p.selected; x.pin.visible = pinned.current.has(id);
    }
    kick();
  }, [hover, p.selected, p.dim, p.labels, data, kick, look]);

  // link lighting follows the same focus
  const near = useMemo(() => { const f = hover || p.selected, s = new Set<string>(); if (f) { s.add(f); for (const x of data.adj.get(f) ?? []) s.add(x); } return s; }, [hover, p.selected, data]);
  const linkColor = useCallback((l: GLink) => {
    const s = typeof l.source === "string" ? l.source : l.source.id, t = typeof l.target === "string" ? l.target : l.target.id;
    if (l.route) return "#d4430e";
    const lit = near.size === 0 || (near.has(s) && near.has(t));
    if (l.virtual) return light ? `rgba(15,18,17,${lit ? .12 : .04})` : `rgba(237,240,236,${lit ? .14 : .05})`;
    const base = l.kind === "cross_domain_bridge" ? (light ? "217,119,6" : "255,212,121") : l.kind === "requires" ? (light ? "47,111,94" : "143,208,181") : (light ? "100,100,120" : "170,175,200");
    return `rgba(${base},${lit ? .85 : .1})`;
  }, [light, near]);
  const linkVisible = useCallback((l: GLink) => !!(l.virtual || l.route || (l.kind === "cross_domain_bridge" ? p.kinds.bridge : l.kind === "requires" ? p.kinds.req : p.kinds.other)), [p.kinds]);
  const linkWidth = useCallback((l: GLink) => l.virtual ? .2 : l.route ? 1.6 : l.kind === "cross_domain_bridge" ? 1.2 : .7, []);
  const particles = useCallback((l: GLink) => l.route ? 4 : !l.virtual && l.kind === "requires" && p.kinds.req ? 1 : 0, [p.kinds.req]);
  const curve = useCallback((l: GLink) => l.kind === "cross_domain_bridge" ? .3 : 0, []);
  const particleColor = useCallback((l: GLink) => l.route ? "#d4430e" : light ? "#2f6f5e" : "#8fd0b5", [light]);

  // camera and forces
  useEffect(() => {
    const g = fg.current; if (!g) return;
    const c = g.controls(); c.autoRotate = true; c.autoRotateSpeed = .3; c.enableDamping = true; c.dampingFactor = .12; c.minDistance = 18; c.maxDistance = 1400; c.zoomSpeed = .9;
    try { g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); } catch { /* keep default */ }
    const stop = () => { c.autoRotate = false; p.onUserMove(); };
    c.addEventListener("start", stop); return () => c.removeEventListener("start", stop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const g = fg.current; if (!g) return;
    const list = p.journeys, centers = new Map<string, [number, number, number]>(), R = list.length > 1 ? 120 + 22 * list.length : 0;
    list.forEach((j, i) => { const y = list.length > 1 ? 1 - 2 * (i + .5) / list.length : 0, r = Math.sqrt(1 - y * y), a = i * 2.39996; centers.set(j.id, [Math.cos(a) * r * R, y * R * .55, Math.sin(a) * r * R]); });
    let ns: GNode[] = [];
    const cluster = Object.assign((alpha: number) => { for (const n of ns) { const c = n.journeyId && centers.get(n.journeyId); if (!c || n.fx !== undefined) continue; const k = (n.hub ? .22 : .06) * alpha;
      (n as any).vx += (c[0] - (n.x ?? 0)) * k; (n as any).vy += (c[1] - (n.y ?? 0)) * k; (n as any).vz += (c[2] - (n.z ?? 0)) * k; } }, {initialize: (nodes: GNode[]) => { ns = nodes; }}); // eslint-disable-line @typescript-eslint/no-explicit-any
    g.d3Force("cluster", cluster); g.d3Force("charge")?.strength((n: GNode) => n.hub ? -160 : -42);
    g.d3Force("link")?.distance((l: GLink) => l.virtual ? 46 : l.route ? 90 : 64).strength((l: GLink) => l.virtual ? .35 : l.route ? .02 : .7);
    g.d3ReheatSimulation?.();
  }, [p.journeys, data]);
  useEffect(() => { const t = [1200, 3200].map(ms => setTimeout(() => fg.current?.zoomToFit(900, 30), ms)); return () => t.forEach(clearTimeout); }, [data]);

  const fly = useCallback((x: number, y: number, z: number, dist = 85) => {
    const d = Math.hypot(x, y, z) || 1, k = 1 + dist / d; fg.current?.cameraPosition({x: x * k, y: y * k, z: z * k}, {x, y, z}, 800);
  }, []);
  const focus = useCallback((id: string) => { const n = data.nodes.find(x => x.id === id); if (n && n.x !== undefined) fly(n.x, n.y ?? 0, n.z ?? 0); }, [data, fly]);
  useImperativeHandle(ref, () => ({
    fit: () => fg.current?.zoomToFit(700, 30), focus,
    rotate: (on: boolean) => { const c = fg.current?.controls(); if (c) c.autoRotate = on; },
    unpin: () => { for (const n of data.nodes) { n.fx = n.fy = n.fz = undefined; } pinned.current.clear(); p.onPins(0); for (const x of parts.current.values()) x.pin.visible = false; fg.current?.d3ReheatSimulation?.(); },
    hub: (goal: string) => { const m = data.nodes.filter(n => n.journeyId === goal && n.x !== undefined); if (!m.length) return; fly(m.reduce((a, n) => a + n.x!, 0) / m.length, m.reduce((a, n) => a + (n.y ?? 0), 0) / m.length, m.reduce((a, n) => a + (n.z ?? 0), 0) / m.length, 170); },
  }), [data, focus, fly, p]);

  const move = (e: React.PointerEvent) => { const r = wrap.current?.getBoundingClientRect(); if (r && tipEl.current) tipEl.current.style.transform = `translate(${Math.min(e.clientX - r.left + 14, r.width - 250)}px, ${Math.max(8, Math.min(e.clientY - r.top + 14, r.height - 110))}px)`; };
  const hovered = tip && hover ? tip : null;

  return <div ref={wrap} className="cv" onPointerMove={move}>
    <ForceGraph3D ref={fg} graphData={data} width={p.width} height={p.height} backgroundColor="rgba(0,0,0,0)" showNavInfo={false}
      nodeThreeObject={build as never} nodeLabel={() => ""} nodeResolution={10} cooldownTicks={120} warmupTicks={24} d3AlphaDecay={.045} d3VelocityDecay={.32}
      enableNodeDrag nodeRelSize={4} nodeVal="val"
      onNodeHover={(n: GNode | null) => { setHover(n && !n.hub ? n.id : ""); setTip(n && !n.hub ? n : null); if (wrap.current) wrap.current.style.cursor = n ? "pointer" : ""; }}
      onNodeClick={(n: GNode) => {
        if (n.hub) { p.onHub(n.journeyId!); return; }
        const now = Date.now(); if (last.current.id === n.id && now - last.current.t < 350) { p.onOpen(n.id); return; }
        last.current = {id: n.id, t: now}; p.onSelect(n.id); if (n.x !== undefined) fly(n.x, n.y ?? 0, n.z ?? 0);
      }}
      onNodeDragEnd={(n: GNode) => { n.fx = n.x; n.fy = n.y; n.fz = n.z; pinned.current.add(n.id); const x = parts.current.get(n.id); if (x) x.pin.visible = true; p.onPins(pinned.current.size); }}
      onBackgroundClick={() => p.onSelect("")}
      linkColor={linkColor as never} linkVisibility={linkVisible as never} linkWidth={linkWidth as never} linkOpacity={1} linkResolution={4}
      linkDirectionalParticles={particles as never} linkDirectionalParticleWidth={1.2} linkDirectionalParticleSpeed={.006} linkDirectionalParticleColor={particleColor as never}
      linkCurvature={curve as never} onEngineStop={() => fg.current?.zoomToFit(900, 30)} />
    <div ref={tipEl} className="tip" data-on={hovered ? "" : undefined} aria-hidden="true">{hovered && <>
      <p className="tip-g"><i className="gm" style={{"--hue": hovered.hue} as React.CSSProperties} />{hovered.journeyName ?? "No goal"}</p><p className="tip-t">{hovered.label}</p>
      <p className="tip-m">{LEVELS[hovered.level]} · {hovered.evidence ? `${hovered.evidence} observation${hovered.evidence > 1 ? "s" : ""}` : "no evidence yet"}</p><p className="tip-h">Click to select · double-click to open · drag to pin</p></>}</div>
  </div>;
});
export default UniverseCanvas;
