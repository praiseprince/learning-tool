function contourPaths(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = (n: number) => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 0) % 1000) / 1000 * n; };
  const cx = 60 + r(80), cy = 40 + r(40), phase = r(6);
  return Array.from({length: 7}, (_, i) => {
    const rad = 10 + i * 13;
    const pts = Array.from({length: 24}, (_, k) => {
      const a = (k / 24) * 6.2832, w = 1 + Math.sin(a * 3 + i + phase) * .12 + Math.cos(a * 2 + seed.length) * .1;
      return [cx + Math.cos(a) * rad * 1.5 * w, cy + Math.sin(a) * rad * w] as const;
    });
    return "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z";
  });
}
/** Survey-map contour lines: the product's signature detail. Deterministic per seed, decorative only. */
export function Contours({seed}: {seed: string}) {
  return <svg className="contours" viewBox="0 0 220 120" aria-hidden="true" preserveAspectRatio="xMidYMid slice">{contourPaths(seed).map((d, i) => <path key={i} d={d} />)}</svg>;
}
