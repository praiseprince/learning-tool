// Files the learner shares in the chat. They are kept in the goal's workspace inbox/ (next to the database, never in the
// repo), listed in context/files.md so the Guide can come back to them in later turns, and served back to the learner.
// Documents the agents cannot open directly (PDF for Codex, Word, RTF) also get a plain-text copy beside them.
import {execFile} from "node:child_process";
import {existsSync, mkdirSync, rmSync, statSync, writeFileSync} from "node:fs";
import {basename, extname} from "node:path";
import {randomUUID} from "node:crypto";
import {promisify} from "node:util";
import {inside} from "../agent/workspace.ts";
import {sqlite} from "../db/client.ts";
import {ensureChat} from "./events.ts";

const run = promisify(execFile);
export {MAX_FILES, MAX_BYTES, ACCEPT, ACCEPT_ATTR, kindOf, refuse, sizeLabel, type Shared} from "./file-types.ts";
import {CONVERT, MAX_FILES, kindOf, refuse, type Shared} from "./file-types.ts";
const safe = (n: string) => basename(n).normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "").slice(-80) || "file";

/** Plain text beside a document, so either engine can read it with ordinary tools. Best effort: the original is always kept. */
async function textCopy(goal: string, stored: string): Promise<string | undefined> {
  const e = extname(stored).toLowerCase(), src = inside(goal, "inbox", stored), out = inside(goal, "inbox", stored + ".txt");
  try {
    if (e === ".pdf") await run("pdftotext", ["-layout", "-enc", "UTF-8", src, out], {timeout: 30_000});
    else if (process.platform === "darwin") await run("textutil", ["-convert", "txt", "-output", out, src], {timeout: 30_000});
    else return undefined;
    return existsSync(out) && statSync(out).size > 0 ? stored + ".txt" : undefined;
  } catch { return undefined; }
}

/** An iPhone photo (HEIC) becomes a JPEG with macOS's own `sips`; elsewhere it is refused with a way out. */
async function toJpeg(goal: string, stored: string, name: string) {
  const src = inside(goal, "inbox", stored), jpg = stored.replace(/\.[^.]+$/, ".jpg");
  try {
    if (process.platform !== "darwin") throw Error();
    await run("sips", ["-s", "format", "jpeg", src, "--out", inside(goal, "inbox", jpg)], {timeout: 30_000});
    rmSync(src, {force: true});
    return {stored: jpg, name: name.replace(/\.[^.]+$/, ".jpg"), size: statSync(inside(goal, "inbox", jpg)).size};
  } catch { rmSync(src, {force: true}); throw Error(`${name} is an iPhone photo (HEIC) that couldn't be converted here. Share it as JPEG instead.`); }
}

/** Saves the files into inbox/ under unique names. Throws with a learner-facing message if any is refused. */
export async function saveShared(goal: string, files: File[]): Promise<Shared[]> {
  if (files.length > MAX_FILES) throw Error(`Share up to ${MAX_FILES} files at a time.`);
  for (const f of files) { const why = refuse(f.name, f.size); if (why) throw Error(why); }
  mkdirSync(inside(goal, "inbox"), {recursive: true});
  const batch = randomUUID().slice(0, 8), out: Shared[] = [];
  for (const f of files) {
    let stored = `${batch}-${safe(f.name)}`, name = basename(f.name).slice(0, 200), size = f.size;
    const type = kindOf(f.name)!;
    writeFileSync(inside(goal, "inbox", stored), Buffer.from(await f.arrayBuffer()));
    if (CONVERT.includes(extname(stored).toLowerCase())) ({stored, name, size} = await toJpeg(goal, stored, name));
    out.push({name, stored, size, type, ...(type === "doc" ? {text: await textCopy(goal, stored)} : {})});
  }
  return out;
}

/** Older events stored only names; newer ones store the full record. */
export function sharedFrom(payload: {files?: unknown}): Shared[] {
  if (!Array.isArray(payload.files)) return [];
  return payload.files.map(f => typeof f === "string" ? {name: f, stored: "", size: 0, type: kindOf(f) ?? "text"} as Shared : f as Shared).filter(f => f && f.name);
}

export type SharedRow = Shared & {seq: number; at: string; said: string};
/** Every file shared in this goal's chat, newest first, with the message it came with. */
export function sharedFiles(goal: string): SharedRow[] {
  ensureChat();
  const rows = sqlite.prepare("SELECT seq,payload_json,created_at FROM chat_event WHERE goal=? AND kind='user' AND status!='withdrawn' AND json_array_length(json_extract(payload_json,'$.files'))>0 ORDER BY seq DESC").all(goal) as {seq: number; payload_json: string; created_at: string}[];
  return rows.flatMap(r => { const p = JSON.parse(r.payload_json); return sharedFrom(p).filter(f => f.stored).map(f => ({...f, seq: r.seq, at: r.created_at, said: String(p.text ?? "")})); });
}
export const fileHref = (goal: string, stored: string, download = false) => `/api/files/${goal}/${encodeURIComponent(stored)}${download ? "?download" : ""}`;
