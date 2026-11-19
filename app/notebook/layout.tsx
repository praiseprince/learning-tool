import {format} from "date-fns";
import {requireV2} from "@/lib/v2/access";
import {ensureNotebook} from "@/lib/v2/notebook";
import {sqlite} from "@/lib/db/client";
import {AppShell} from "@/components/v2/shell";
import {NotesShell, type NoteRow} from "@/components/v2/notes-shell";

export const dynamic = "force-dynamic";

/** A readable preview: prose lines first; tables, code, headings and rules are skipped. */
const strip = (md: string) => {
  const clean = (t: string) => t.replace(/\[\[([^\]]+)\]\]/g, "$1").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`>$\\]+/g, "").replace(/^\s*([-+*]|\d+\.)\s+/, "").replace(/\s+/g, " ").trim();
  const body = md.replace(/```[\s\S]*?```/g, "\n").replace(/\$\$[\s\S]*?\$\$/g, "\n").split("\n");
  const prose = body.filter(l => l.trim() && !/^\s*(#|\||-{3,}|={3,}|<!--)/.test(l)).map(clean).filter(Boolean);
  if (prose.length) return prose.join(" ");
  const cells = body.filter(l => /^\s*\|/.test(l) && !/^\s*\|?\s*:?-{2,}/.test(l)).slice(1, 3).map(l => l.split("|").map(c => clean(c)).filter(Boolean).join(", "));
  return cells.join(" · ");
};

export default function NotebookLayout({children}: LayoutProps<"/notebook">) {
  requireV2(); ensureNotebook();
  const docs = sqlite.prepare("SELECT d.id,d.title,d.updated_at,d.journey_id,r.content_md FROM document d JOIN document_revision r ON r.id=d.current_revision_id WHERE d.status='active' ORDER BY d.updated_at DESC").all() as {id: string; title: string; updated_at: string; journey_id: string | null; content_md: string}[];
  const sources = sqlite.prepare("SELECT id,title,creator,notes,created_at FROM resource ORDER BY created_at DESC").all() as {id: string; title: string; creator: string; notes: string; created_at: string}[];
  const goals = sqlite.prepare("SELECT id,name,hue FROM journey WHERE status='active' ORDER BY name COLLATE NOCASE").all() as {id: string; name: string; hue: number}[];
  const inbox = (sqlite.prepare("SELECT COUNT(*) n FROM proposal WHERE kind IN ('facet_update','bridge') AND status IN ('pending','unsupported')").get() as {n: number}).n;
  const rows: NoteRow[] = [
    ...docs.map(d => ({id: d.id, title: d.title, snippet: strip(d.content_md).slice(0, 140), haystack: (d.title + " " + d.content_md.slice(0, 3000)).toLowerCase(), updated: format(new Date(d.updated_at), "d MMM"), goal: d.journey_id, kind: "note" as const})),
    ...sources.map(s => ({id: s.id, title: s.title, snippet: [s.creator, s.notes].filter(Boolean).join(" · ").slice(0, 140), haystack: (s.title + " " + s.creator + " " + s.notes).toLowerCase(), updated: format(new Date(s.created_at), "d MMM"), goal: null, kind: "source" as const})),
  ];
  return <AppShell active="Notes"><NotesShell notes={rows} goals={goals} inbox={inbox}>{children}</NotesShell></AppShell>;
}
