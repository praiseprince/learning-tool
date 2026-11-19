import Link from "next/link";
import type {CSSProperties} from "react";
import {sqlite} from "@/lib/db/client";
import {requireV2} from "@/lib/v2/access";
import {v2Enabled} from "@/lib/v2/flag";
import {APP_NAME} from "@/lib/constants";
import {GoalMenu} from "@/components/chat/goal-menu";
import {PanelOpen} from "@/components/chat/panel-toggle";
import {Palette, PaletteTrigger, type PaletteItem} from "./palette";

export type Section = "Chat" | "Today" | "Goals" | "Progress" | "Map" | "Notes" | "Settings";

/** One frame for every screen: a slim top bar with the goal switcher. Inside a goal, the goal's colour is the accent. */
export function AppShell({children, active, hue, goal, bare = false}: {children: React.ReactNode; active: Section; hue?: number; goal?: string; bare?: boolean}) {
  const v2 = v2Enabled();
  const goals = sqlite.prepare("SELECT id,name,hue FROM journey WHERE status='active' ORDER BY name COLLATE NOCASE").all() as {id: string; name: string; hue: number}[];
  const pal: PaletteItem[] = [
    {id: "pc", label: "Chat", hint: "Page", href: "/"}, ...(v2 ? [{id: "pm", label: "Map", hint: "Page", href: "/atlas"}, {id: "pn", label: "Notes", hint: "Page", href: "/notebook"}, {id: "pg", label: "All goals", hint: "Page", href: "/goals"}] : []),
    {id: "ps", label: "Settings", hint: "Page", href: "/you"}, ...(v2 ? [{id: "new", label: "Add a goal", hint: "Action", href: "/goals/new"}] : []),
    ...goals.map(g => ({id: "g" + g.id, label: g.name, hint: "Goal", href: `/?goal=${g.id}`, hue: g.hue})),
    ...(v2 ? (sqlite.prepare("SELECT id,title FROM document WHERE status='active' ORDER BY updated_at DESC LIMIT 200").all() as {id: string; title: string}[]).map(d => ({id: "d" + d.id, label: d.title, hint: "Note", href: "/notebook/d/" + d.id})) : []),
    ...(v2 ? (sqlite.prepare("SELECT n.id,n.label,(SELECT j.hue FROM atlas_membership m JOIN journey j ON j.id=m.journey_id WHERE m.node_id=n.id LIMIT 1) AS hue FROM atlas_node n WHERE n.id NOT IN (SELECT source FROM atlas_redirect) ORDER BY n.label LIMIT 600").all() as {id: string; label: string; hue: number | null}[]).map(n => ({id: "n" + n.id, label: n.label, hint: "Skill", href: "/atlas/n/" + n.id, hue: n.hue ?? 250})) : []),
  ];
  const links = v2 ? [{k: "Map", href: "/atlas"}, {k: "Notes", href: "/notebook"}] : [];
  return <div className={"app" + (bare ? " app--bare" : "")} data-chapter={hue === undefined ? "neutral" : "goal"} style={hue === undefined ? undefined : ({"--hue": hue} as CSSProperties)}>
    <header className="mast">
      <Link className="brand" href="/">{APP_NAME}</Link>
      {goals.length > 0 && <GoalMenu goals={goals} current={goal} />}
      <nav aria-label="Primary">{links.map(i => <Link key={i.k} aria-current={active === i.k ? "page" : undefined} href={i.href}>{i.k}</Link>)}</nav>
      <div className="mast-r">{active === "Chat" && goal && <PanelOpen />}<PaletteTrigger /><Link href="/you" aria-current={active === "Settings" ? "page" : undefined}>Settings</Link></div>
    </header>
    <main className="main">{children}</main>
    <nav className="tabbar" aria-label="Primary"><Link href="/" aria-current={active === "Chat" || active === "Today" ? "page" : undefined}>Chat</Link>{links.map(i => <Link key={i.k} aria-current={active === i.k ? "page" : undefined} href={i.href}>{i.k}</Link>)}<Link href="/you" aria-current={active === "Settings" ? "page" : undefined}>Settings</Link></nav>
    <Palette items={pal} />
  </div>;
}

export function V2Shell({children, active, hue, goal}: {children: React.ReactNode; active: Section; hue?: number; goal?: string}) {
  requireV2();
  return <AppShell active={active} hue={hue} goal={goal}>{children}</AppShell>;
}
