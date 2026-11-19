import type {CSSProperties} from "react";
import type {GoalStat} from "@/lib/v2/stats";

const tone = (hue: number, l = .6) => `oklch(${l} .14 ${hue})`;

/** Practice calendar: one cell per day, columns are weeks. Intensity = minutes. */
export function Calendar({days, weekStart}: {days: {date: string; minutes: number; sessions: number}[]; weekStart: 0 | 1}) {
  const max = Math.max(30, ...days.map(d => d.minutes)), cols = days.length / 7, cell = 16, gap = 4, left = 30;
  const names = weekStart === 1 ? ["Mon", "", "Wed", "", "Fri", "", ""] : ["", "Mon", "", "Wed", "", "Fri", ""];
  const months: {x: number; t: string}[] = [];
  days.forEach((d, i) => { if (i % 7 === 0) { const t = new Date(d.date + "T12:00:00").toLocaleString("en", {month: "short"}), x = left + (i / 7) * (cell + gap); if (t !== months.at(-1)?.t && (!months.length || x - months.at(-1)!.x > 50)) months.push({x, t}); } });
  const step = (m: number) => m === 0 ? 0 : m < max * .25 ? 1 : m < max * .5 ? 2 : m < max * .75 ? 3 : 4;
  return <figure className="cal"><svg viewBox={`0 0 ${left + cols * (cell + gap)} ${22 + 7 * (cell + gap)}`} role="img" aria-label={`Practice over ${cols} weeks: ${days.filter(d => d.minutes).length} days with practice, ${days.reduce((a, d) => a + d.minutes, 0)} minutes`}>
    {months.map(m => <text key={m.x} x={m.x} y="10" className="ax">{m.t}</text>)}
    {names.map((n, r) => n && <text key={r} x="0" y={20 + r * (cell + gap) + 12} className="ax">{n}</text>)}
    {days.map((d, i) => <rect key={d.date} x={left + Math.floor(i / 7) * (cell + gap)} y={20 + (i % 7) * (cell + gap)} width={cell} height={cell} rx="2" className={"c c" + step(d.minutes)} style={{"--i": Math.floor(i / 7)} as CSSProperties}>
      <title>{d.minutes ? `${d.date}: ${d.minutes} min, ${d.sessions} ${d.sessions === 1 ? "session" : "sessions"}` : `${d.date}: no practice`}</title></rect>)}
  </svg><figcaption className="legend"><span>Less</span>{[0, 1, 2, 3, 4].map(n => <i key={n} className={"c c" + n} />)}<span>More</span></figcaption></figure>;
}

/** Minutes per week, stacked by goal. The current week is the last bar. */
export function WeekBars({goals, weeks}: {goals: GoalStat[]; weeks: number}) {
  const totals = Array.from({length: weeks}, (_, w) => goals.reduce((a, g) => a + g.weekly[w], 0));
  const max = Math.max(60, ...totals), W = 480, H = 140, bw = W / weeks;
  return <figure><svg className="bars" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label={`Minutes per week for ${weeks} weeks. This week: ${totals[weeks - 1]} minutes.`}>
    {[.5, 1].map(f => <line key={f} x1="0" x2={W} y1={H - f * (H - 6)} y2={H - f * (H - 6)} className="grid" />)}
    {totals.map((t, w) => { let y = H; return <g key={w} className="bar" style={{"--i": w} as CSSProperties}>{goals.map(g => { const h = (g.weekly[w] / max) * (H - 6); y -= h; return h > 0 ? <rect key={g.id} x={w * bw + 6} y={y} width={bw - 12} height={Math.max(2, h - 1)} rx="2" fill={tone(g.hue)}><title>{`${g.name}: ${g.weekly[w]} min`}</title></rect> : null; })}
      {t === 0 && <rect x={w * bw + 6} y={H - 2} width={bw - 12} height="2" className="none" />}</g>; })}
    <text x="0" y={H + 15} className="ax">{weeks} weeks ago</text><text x={W} y={H + 15} textAnchor="end" className="ax">This week</text></svg>
    <figcaption className="key">{goals.map(g => <span key={g.id}><i className="gm" style={{"--hue": g.hue} as CSSProperties} />{g.name}</span>)}</figcaption></figure>;
}

/** Share of practice by weekday. */
export function Weekdays({minutes, weekStart}: {minutes: number[]; weekStart: 0 | 1}) {
  const order = weekStart === 1 ? [0, 1, 2, 3, 4, 5, 6] : [6, 0, 1, 2, 3, 4, 5], names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], max = Math.max(1, ...minutes), best = minutes.indexOf(Math.max(...minutes));
  return <ul className="wd" aria-label="Minutes by weekday">{order.map(i => <li key={i} className={i === best && minutes[i] > 0 ? "best" : ""}><span className="bar-v" style={{height: `${Math.max(4, (minutes[i] / max) * 100)}%`}} title={`${names[i]}: ${minutes[i]} min`} /><small>{names[i]}</small></li>)}</ul>;
}

/** Skills by level for one goal, as a single segmented bar. */
export function Levels({levels, hue}: {levels: number[]; hue: number}) {
  const total = levels.reduce((a, b) => a + b, 0) || 1;
  return <div className="levels" role="img" aria-label={`Skills by level: ${levels.map((n, i) => `${n} at level ${i}`).join(", ")}`}>{levels.map((n, i) => n > 0 && <span key={i} style={{flexGrow: n / total, background: i === 0 ? "var(--rule)" : tone(hue, .78 - i * .09)}} title={`Level ${i}: ${n}`} />)}</div>;
}

/** Twelve weeks of minutes for one goal. */
export function Trend({values, hue}: {values: number[]; hue: number}) {
  const w = 120, h = 28, max = Math.max(1, ...values), step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`).join(" ");
  return <svg className="trend" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={tone(hue, .55)} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>;
}
