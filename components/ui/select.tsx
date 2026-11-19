"use client";
import {Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode} from "react";

type Opt = {value: string; label: string};
type OptionEl = ReactElement<{value?: string | number; children?: ReactNode; disabled?: boolean}>;
const text = (n: ReactNode): string => Children.toArray(n).map(c => typeof c === "string" || typeof c === "number" ? String(c) : isValidElement(c) ? text((c.props as {children?: ReactNode}).children) : "").join("");

/** A dropdown with the same look as every other menu in the app. Drop-in for <select>: takes <option> children, name, defaultValue / value and onChange. */
export function Select({name, defaultValue, value, onChange, children, style, className = "", ...rest}: {name?: string; defaultValue?: string | number; value?: string | number; onChange?: (e: {target: {value: string}}) => void; children: ReactNode; style?: CSSProperties; className?: string; "aria-label"?: string}) {
  const opts = useMemo<Opt[]>(() => Children.toArray(children).filter((c): c is OptionEl => isValidElement(c) && c.type === "option").map(c => ({value: String(c.props.value ?? text(c.props.children)), label: text(c.props.children)})), [children]);
  const [inner, setInner] = useState(String(defaultValue ?? opts[0]?.value ?? "")), [open, setOpen] = useState(false), [at, setAt] = useState(0);
  const cur = value !== undefined ? String(value) : inner, box = useRef<HTMLDivElement>(null), id = useId(), now = opts.find(o => o.value === cur) ?? opts[0];
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away); return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const pick = (v: string) => { setInner(v); setOpen(false); onChange?.({target: {value: v}}); box.current?.querySelector("button")?.focus(); };
  const show = () => { setAt(Math.max(0, opts.findIndex(o => o.value === cur))); setOpen(true); };
  return <div className={"sel " + className} ref={box} style={style}>
    {name && <input type="hidden" name={name} value={cur} />}
    <button type="button" className="sel-btn" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-controls={id} aria-label={rest["aria-label"]}
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={e => {
        if (e.key === "Escape") setOpen(false);
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!open) show(); else setAt(a => Math.max(0, Math.min(opts.length - 1, a + (e.key === "ArrowDown" ? 1 : -1)))); }
        else if ((e.key === "Enter" || e.key === " ") && open) { e.preventDefault(); pick(opts[at].value); }
        else if (e.key === "Tab") setOpen(false);
      }}><span>{now?.label ?? ""}</span><i aria-hidden="true" /></button>
    {open && <ul className="menu" id={id} role="listbox">{opts.map((o, i) => <li key={o.value} role="option" aria-selected={o.value === cur}>
      <button type="button" tabIndex={-1} className={i === at ? "on" : ""} onMouseEnter={() => setAt(i)} onClick={() => pick(o.value)}><span>{o.label}</span>{o.value === cur && <b aria-hidden="true">✓</b>}</button></li>)}</ul>}
  </div>;
}
