import {randomUUID} from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import {sqlite} from "../db/client.ts";
import {ensureGuide} from "../v2/guide.ts";
import {materials} from "../v2/materials.ts";
import {storeDocument} from "../v2/notebook.ts";
import {skillRows} from "../v2/goals.ts";
import {addEvent} from "../chat/events.ts";
import type {JobInput, JobKind, Results} from "./tasks.ts";

export type Check = {ok: boolean; status: number; title: string; at: string; note: string};

const privateIp = (ip: string) => {
  if (net.isIPv6(ip)) return ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith("::ffff:127.");
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
};
const words = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter(w => !["with", "from", "that", "this", "your", "volume", "edition", "course", "guide"].includes(w));

/** The app checks a link itself instead of trusting the model: it must resolve, be public, and mention the title. */
export async function checkUrl(url: string, title: string): Promise<Check> {
  const at = new Date().toISOString(), fail = (note: string, status = 0): Check => ({ok: false, status, title: "", at, note});
  let u: URL; try { u = new URL(url); } catch { return fail("No valid link."); }
  if (!/^https?:$/.test(u.protocol)) return fail("Not a web link.");
  try { const a = await dns.lookup(u.hostname, {all: true}); if (!a.length || a.some(x => privateIp(x.address))) return fail("Not a public address."); } catch { return fail("The address did not resolve."); }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(u, {signal: ctl.signal, redirect: "follow", headers: {"user-agent": "Mozilla/5.0 (compatible; MarginaliaLinkCheck/1.0)", accept: "text/html,*/*"}});
    if (!r.ok) return fail(`The page answered ${r.status}.`, r.status);
    const text = (await r.text()).slice(0, 200_000), t = (text.match(/<title[^>]*>([^<]{1,300})/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
    const need = words(title).slice(0, 4), hay = (t + " " + text.slice(0, 60_000)).toLowerCase(), hits = need.filter(w => hay.includes(w)).length;
    const ok = need.length === 0 ? true : hits >= Math.min(2, need.length);
    return {ok, status: r.status, title: t, at, note: ok ? "The page loads and mentions the title." : "The page loads but does not clearly mention the title."};
  } catch { return fail("The page did not respond in time."); }
  finally { clearTimeout(timer); }
}

const addProposal = (goal: string, kind: string, payload: unknown, source: string) => {
  const id = randomUUID(), now = new Date().toISOString();
  sqlite.prepare("INSERT INTO proposal VALUES (?,?,?,?,'pending',?,?,NULL)").run(id, goal, kind, JSON.stringify(payload), source, now); return id;
};

export async function ingest(job: {id: string; goal: string; kind: JobKind; input: JobInput}, result: Results[JobKind]) {
  const {id, goal, kind, input} = job;
  if (kind === "research") {
    const r = result as Results["research"], have = materials(goal), seen = new Set(have.flatMap(m => [m.title.toLowerCase(), m.url]).filter(Boolean));
    const pending = new Set((sqlite.prepare("SELECT diff_json FROM proposal WHERE journey_id=? AND kind='agent_material' AND status='pending'").all(goal) as {diff_json: string}[]).map(x => { try { return JSON.parse(x.diff_json).suggestion.title.toLowerCase(); } catch { return ""; } }));
    const made: string[] = [];
    for (const sug of r.suggestions) {
      if (seen.has(sug.title.toLowerCase()) || (sug.url && seen.has(sug.url)) || pending.has(sug.title.toLowerCase())) continue;
      const check = sug.url && process.env.AI_PROVIDER !== "stub" ? await checkUrl(sug.url, sug.title) : {ok: false, status: 0, title: "", at: new Date().toISOString(), note: sug.url ? "Not checked (stub mode)." : "No link given."};
      made.push(addProposal(goal, "agent_material", {suggestion: sug, check, summary: r.summary}, id));
    }
    addEvent(goal, "guide", {markdown: made.length ? r.summary : `${r.summary}\n\nEverything I found is already in your materials or waiting for you.`});
    if (made.length) addEvent(goal, "suggestions", {ids: made});
  } else if (kind === "ask") {
    const r = result as Results["ask"]; void ensureGuide;
    addEvent(goal, "guide", {markdown: r.answer, sources: r.sources});
    const ids = r.proposals.map(p => addProposal(goal, "agent_action", p, id));
    if (ids.length) addEvent(goal, "suggestions", {ids});
  } else if (kind === "review") {
    const r = result as Results["review"], doc = randomUUID();
    const body = [`# Feedback on your work`, "", r.feedback, "", r.strengths.length ? "## Working well\n" + r.strengths.map(x => `- ${x}`).join("\n") : "", r.fixes.length ? "\n## Worth fixing\n" + r.fixes.map(x => `- ${x}`).join("\n") : "", `\n## Next step\n${r.next_step}`,
      input.files?.length ? `\n---\nShared: ${input.files.join(", ")}` : ""].filter(Boolean).join("\n");
    storeDocument({id: doc, base: null, title: `Feedback: ${(r.summary || "your work").slice(0, 80)}`, body, kind: "reflection", journey: goal, author: "ai"});
    addEvent(goal, "guide", {markdown: [`**${r.summary}**`, "", r.feedback, r.strengths.length ? "\n**Working well**\n" + r.strengths.map(x => `- ${x}`).join("\n") : "", r.fixes.length ? "\n**Worth fixing**\n" + r.fixes.map(x => `- ${x}`).join("\n") : "", `\n**Next step:** ${r.next_step}`].filter(Boolean).join("\n")});
    addEvent(goal, "note", {doc, title: "Feedback saved to your notes"});
    const evIds: string[] = [];
    const said = (input.text ?? "").trim();
    if (said && r.evidence.length) {
      const entry = randomUUID(), now = new Date().toISOString(), day = now.slice(0, 10);
      sqlite.prepare("INSERT INTO log_entry (id,journey_id,raw_text,minutes,energy,kind,occurred_on,created_at) VALUES (?,?,?,NULL,NULL,'practice',?,?)").run(entry, goal, said, day, now);
      const skills = skillRows(goal);
      for (const ev of r.evidence) {
        const sk = skills.find(k => k.name.toLowerCase() === ev.skill.toLowerCase()); if (!sk || !said.includes(ev.quote)) continue;
        evIds.push(addProposal(goal, "agent_evidence", {skill: sk.id, skillName: sk.name, quote: ev.quote, hint: ev.level_hint, entry, doc}, id));
      }
      if (evIds.length) addEvent(goal, "suggestions", {ids: evIds});
    }
  } else if (kind === "week") {
    const r = result as Results["week"], days = [...new Map(r.days.map(d => [d.date, d])).values()].sort((a, b) => a.date.localeCompare(b.date));
    const wid = addProposal(goal, "week_plan", {review: r.review, days}, id);
    addEvent(goal, "week", {week: wid});
    const ids = r.adjustments.map(a => addProposal(goal, "agent_action", {...a, url: ""}, id));
    if (ids.length) addEvent(goal, "suggestions", {ids});
  } else if (kind === "quiz") {
    const r = result as Results["quiz"];
    addEvent(goal, "quiz", {job: id, title: r.title, questions: r.questions});
  } else {
    const r = result as Results["practice"], doc = randomUUID(), skills = skillRows(goal);
    const links = r.skills.map(n => skills.find(k => k.name.toLowerCase() === n.toLowerCase())?.name).filter(Boolean) as string[];
    const files = r.files.length ? "\n\n## Files\n" + r.files.map(f => `- [${f.title}](/api/workspace/${goal}/${id}/${encodeURI(f.path)})`).join("\n") : "";
    const body = r.note + files + (links.length ? "\n\n---\nPractises: " + links.map(n => `[[${n}]]`).join(", ") : "");
    storeDocument({id: doc, base: null, title: r.title, body, kind: "note", journey: goal, author: "ai"});
    addEvent(goal, "guide", {markdown: `${r.summary || "I made some practice material for you."}`});
    addEvent(goal, "note", {doc, title: r.title, files: r.files.map(f => ({title: f.title, href: `/api/workspace/${goal}/${id}/${encodeURI(f.path)}`}))});
  }
}
