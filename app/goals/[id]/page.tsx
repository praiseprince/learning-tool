import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {format} from "date-fns";
import {goalDetail, goalNotes, history, skillRows, LEVELS} from "@/lib/v2/goals";
import {V2Shell} from "@/components/v2/shell";
import {Meter, Tabs} from "@/components/v2/ui";
import {materials} from "@/lib/v2/materials";
import {MaterialsPanel} from "@/components/v2/materials";
import {newNote} from "@/app/notebook/actions";
import {setGoalStatus} from "../actions";
import {format as fmt, startOfWeek} from "date-fns";
import {sqlite} from "@/lib/db/client";
import {preferences} from "@/lib/db/personal";
import {currentWeek, doneDays} from "@/lib/agent/week";
import {nextDays} from "@/lib/agent/tasks";
import {ago, dayLabel} from "@/lib/v2/when";
import {GuideButton} from "@/components/chat/find-button";
import {fileHref, sharedFiles} from "@/lib/chat/files";
import {sizeLabel} from "@/lib/chat/file-types";
import {extname} from "@/lib/chat/ext";
import {fileToMaterial} from "../material-actions";

const TABS = [["plan", "Overview"], ["skills", "Skills"], ["materials", "Materials"], ["notes", "Notes"], ["files", "Files"], ["history", "History"]] as const;

export default async function GoalPage({params, searchParams}: PageProps<"/goals/[id]">) {
  const {id} = await params, q = await searchParams, d = goalDetail(id);
  if (!d) notFound();
  if (q.tab === "guide") redirect(`/?goal=${id}`);
  const tab = TABS.some(t => t[0] === q.tab) ? String(q.tab) : "plan";
  const {goal, charter, steps, current, versions} = d;
  return <V2Shell active="Goals" hue={goal.hue} goal={id}><div className="page">
    <p className="back"><Link href="/goals">← Goals</Link></p>
    <h1><i className="gm" aria-hidden="true" />{goal.name}</h1>
    <p className="standfirst">{goal.goal}</p>
    <div className="actions head-actions"><Link className="btn" href={`/?goal=${id}`}>Open the chat</Link><Link className="btn btn--quiet" href={`/goals/${id}/revise`}>Revise goal</Link><Link className="btn btn--text" href={`/atlas?goal=${id}`}>See on the map</Link></div>
    {goal.status !== "active" && <p className="form-note" role="status">This goal is {goal.status}. It is hidden from the chat, the Map and search. <form action={setGoalStatus.bind(null, id, "active")} style={{display: "inline"}}><button className="btn btn--text">Resume it</button></form></p>}
    {q.created && <p className="form-note" role="status">Goal created. Your map and roadmap are ready. Ask for today’s session when you are.</p>}
    {q.revised && <p className="form-note" role="status">Goal revised. The earlier version is kept under “Versions”.</p>}
    <Tabs current={tab} items={TABS.map(([key, label]) => ({key, label, href: `/goals/${id}${key === "plan" ? "" : "?tab=" + key}`}))} />

    {tab === "plan" && (() => {
      const skills = skillRows(id), solid = skills.filter(x => x.level >= 4).length, week = currentWeek(id), today = nextDays(1)[0], did = doneDays(id, week?.days.map(x => x.date) ?? []);
      const start = fmt(startOfWeek(new Date(), {weekStartsOn: preferences().week_start}), "yyyy-MM-dd");
      const wk = sqlite.prepare("SELECT COUNT(*) AS n,COALESCE(SUM(COALESCE(t.minutes,e.minutes,0)),0) AS m FROM log_entry e LEFT JOIN entry_time t ON t.entry_id=e.id WHERE e.journey_id=? AND e.kind='practice' AND e.occurred_on>=?").get(id, start) as {n: number; m: number};
      return <>
      <dl className="stats">
        <div><dt>This week</dt><dd className="num">{wk.m}<small> min</small></dd><p>{wk.n} {wk.n === 1 ? "session" : "sessions"}</p></div>
        <div><dt>All time</dt><dd className="num">{goal.sessions}<small> {goal.sessions === 1 ? "session" : "sessions"}</small></dd><p>{goal.last ? `last ${ago(goal.last)}` : "none yet"}</p></div>
        <div><dt>Skills</dt><dd className="num">{solid}<small> of {skills.length} solid</small></dd><p>{skills.filter(x => x.level > 0 && x.level < 4).length} in progress</p></div>
        <div><dt>Roadmap</dt><dd className="num">{steps.length ? <>{Math.min(current + 1, steps.length)}<small> of {steps.length}</small></> : "–"}</dd><p className="clamp-1">{steps[current]?.title ?? "No roadmap yet"}</p></div>
      </dl>
      <section className="ov"><div className="ov-h"><h2>This week</h2>{goal.status === "active" && <GuideButton goal={id} kind="week" label={week ? "Plan it again" : "Plan my week"} />}</div>
        {week ? <ol className="wk-mini wk-wide">{week.days.map(x => <li key={x.date} className={(x.date === today ? "today " : "") + (x.minutes === 0 ? "rest " : "") + (did.has(x.date) ? "done" : "")}>
          <span className="num">{new Date(x.date + "T12:00").toLocaleDateString("en-GB", {weekday: "short"})}</span><span className="f" title={x.why}>{x.minutes ? x.focus : "Rest"}</span>{did.has(x.date) ? <span aria-label="done">✓</span> : x.minutes ? <span className="muted num">{x.minutes} min</span> : <span />}</li>)}</ol>
          : <p className="muted">No week plan yet. The Guide looks back at your last two weeks and drafts one line per day, rest days included.</p>}</section>
      <section className="ov"><h2>Where you are</h2><p className="prose">{goal.position || "Not described yet."}</p>
        {(charter?.done || charter?.constraints) && <dl className="facts-dl">{charter?.done && <><dt>Done looks like</dt><dd>{charter.done}</dd></>}{charter?.constraints && <><dt>Constraints</dt><dd>{charter.constraints}</dd></>}</dl>}</section>
      <section className="ov"><h2>Roadmap</h2>
        {steps.length ? <ol className="toc">{steps.map((st, i) => <li key={i} className={i === current ? "here" : i < current ? "done" : ""}><span className="tt">{st.title}</span>{i <= current && <span className="st">{i === current ? "You are here" : "Done"}</span>}<p className="why">{st.reason}</p></li>)}</ol> : <p className="muted">No roadmap yet. Today’s plans still work from your map.</p>}</section>
      {versions.length > 1 && <section className="ov"><details className="free"><summary className="link">Earlier versions · {versions.length - 1}</summary>
        <ul className="rows" style={{marginTop: 12}}>{versions.map(v => <li key={v.version}><div className="row"><div><div className="t">Version {v.version}{v.version === versions[0].version ? " · current" : ""}</div>{v.note && <p className="s">{v.note.length > 220 ? v.note.slice(0, 220) + "…" : v.note}</p>}</div><div className="m num">{format(new Date(v.created_at), "d MMM yyyy")}</div></div></li>)}</ul></details></section>}</>;
    })()}

    {tab === "skills" && (() => {
      const rows = skillRows(id), groups: [string, typeof rows][] = [["In progress", rows.filter(r => r.level > 0 && r.level < 4)], ["Solid", rows.filter(r => r.level >= 4)], ["Not started", rows.filter(r => r.level === 0)]];
      return <div className="skill-groups">{rows.length === 0 && <p className="muted">No skills yet.</p>}{groups.map(([title, list]) => list.length > 0 && <section key={title}><h2 className="group-h">{title} <span className="num">{list.length}</span></h2>
        <ul className="rows rows--tight">{list.map(r => <li key={r.id}><Link className="row" href={`/atlas/n/${r.node}`}><div><div className="t">{r.name}</div>
          <p className="s">{LEVELS[r.level]}{r.evidence ? ` · ${r.evidence} observation${r.evidence > 1 ? "s" : ""}` : " · no evidence yet"}{r.last ? ` · ${ago(r.last)}` : ""}</p></div><Meter level={r.level} label={LEVELS[r.level]} /></Link></li>)}</ul></section>)}</div>;
    })()}

    {tab === "materials" && <MaterialsPanel goal={id} items={materials(id)} added={!!q.added} bad={!!q.bad} />}

    {tab === "notes" && (() => {
      const notes = goalNotes(id);
      return <div className="stack">
        <form action={newNote}><input type="hidden" name="goal" value={id} /><input type="hidden" name="title" value="Untitled note" /><button className="btn btn--quiet btn--sm">New note</button></form>
        {notes.length ? <ul className="rows">{notes.map(n => <li key={n.id}><Link className="row" href={`/notebook/d/${n.id}`}><div className="t">{n.title}</div><div className="m num">{format(new Date(n.updated_at), "d MMM")}</div></Link></li>)}</ul>
          : <p className="muted">No notes for this goal yet.</p>}</div>;
    })()}

    {tab === "files" && (() => {
      const files = sharedFiles(id), used = new Set(materials(id).map(m => m.url));
      return <div className="stack">
        <p className="hint">Everything you shared in this goal’s chat. The Guide can open any of them again: ask about one by name.</p>
        {files.length ? <ul className="rows file-rows">{files.map(f => <li key={f.stored}><div className="row">
          {/* eslint-disable-next-line @next/next/no-img-element -- the learner's own file */}
          {f.type === "image" ? <img src={fileHref(id, f.stored)} alt="" loading="lazy" /> : <span className="ext" aria-hidden="true">{extname(f.name).slice(1, 5) || "file"}</span>}
          <div><a className="t" href={fileHref(id, f.stored, true)} title={`Download ${f.name}`}><bdi>{f.name}</bdi></a>
            <p className="s">{format(new Date(f.at), "d MMM yyyy")} · {sizeLabel(f.size)}{f.said ? <> · “<bdi>{f.said.length > 90 ? f.said.slice(0, 88) + "…" : f.said}</bdi>”</> : null}</p></div>
          <div className="actions"><Link className="btn btn--text btn--sm" href={`/?goal=${id}&at=${f.seq}#m${f.seq}`}>In the chat</Link>
            {f.type !== "image" && (used.has(fileHref(id, f.stored)) ? <span className="muted small">In materials</span> : <form action={fileToMaterial.bind(null, id, f.stored)}><button className="btn btn--quiet btn--sm">Add to materials</button></form>)}</div>
        </div></li>)}</ul> : <p className="muted">No files yet. Drop, paste or attach them in the chat: photos of your work, PDFs, notes or code.</p>}
      </div>;
    })()}

    {tab === "history" && (() => {
      const h = history(id);
      return <div className="stack stack--lg">
        {h.moves.length > 0 && <section><h2>Skill moves</h2><ul className="rows">{h.moves.slice(0, 12).map(m => <li key={m.id}><Link className="row" href={`/atlas/n/${m.node}`}><div><div className="t">{m.skill}</div><p className="quote">“{m.quote}”</p></div>
          <div className="m num"><Meter level={m.level} /><br />{ago(m.at)}</div></Link></li>)}</ul></section>}
        <section><h2>Sessions</h2>{h.sessions.length ? h.sessions.map(s => <div key={s.id} className="log-day" id={"e-" + s.id}><time className="num">{dayLabel(s.occurred_on)}{s.minutes ? ` · ${s.minutes} min` : ""}</time><p className="prose">{s.raw_text}</p></div>) : <p className="muted">No sessions yet.</p>}</section></div>;
    })()}
    {goal.status === "active" && <section className="section"><details className="free"><summary className="link">Pause or archive this goal</summary>
      <p className="hint" style={{margin: "12px 0"}}>Pausing or archiving hides it from Today, the Map and search. Your history, notes and evidence stay, and you can resume any time.</p>
      <div className="actions"><form action={setGoalStatus.bind(null, id, "paused")}><button className="btn btn--quiet btn--sm">Pause</button></form><form action={setGoalStatus.bind(null, id, "archived")}><button className="btn btn--quiet btn--sm">Archive</button></form></div></details></section>}
  </div></V2Shell>;
}
