import Link from "next/link";
import type {CSSProperties, ReactNode} from "react";

/** A goal's name with its color mark. The only place goal color sits beside text. */
export function GoalName({name, hue}: {name: string; hue: number}) {
  return <span className="gname"><i className="gm" style={{"--hue": hue} as CSSProperties} aria-hidden="true" />{name}</span>;
}

export function Head({title, lede, back, actions, eyebrow}: {title: ReactNode; lede?: ReactNode; back?: {href: string; label: string}; actions?: ReactNode; eyebrow?: ReactNode}) {
  return <header className="head">
    {back && <Link className="back" href={back.href}>← {back.label}</Link>}
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    <div className="row-top"><h1>{title}</h1>{actions && <div className="actions">{actions}</div>}</div>
    {lede && <p className="lede">{lede}</p>}
  </header>;
}

export function Tabs({items, current}: {items: {key: string; label: string; href: string}[]; current: string}) {
  return <nav className="tabs" aria-label="Sections">{items.map(i => <Link key={i.key} href={i.href} aria-current={i.key === current ? "page" : undefined}>{i.label}</Link>)}</nav>;
}

export function Meter({level, label}: {level: number; label?: string}) {
  return <span className="meter" role="img" aria-label={label ?? `Level ${level} of 5`}>{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= level ? "on" : ""} />)}</span>;
}

/** Picks which goal a screen is about, as a line of text. Wraps instead of truncating, so long names stay readable. */
export function GoalSwitch({goals, current, href}: {goals: {id: string; name: string; hue: number}[]; current: string; href: (id: string) => string}) {
  return <nav className="reading-line" aria-label="Goal"><span>Reading</span>{goals.map(g => <Link key={g.id} href={href(g.id)} aria-current={g.id === current ? "page" : undefined}>{g.name}</Link>)}</nav>;
}
