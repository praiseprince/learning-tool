import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Chip({ selected, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; children: ReactNode }) {
  return <button className={`chip ${selected ? "chip--selected" : ""} ${className}`} aria-pressed={selected} {...props}>{children}</button>;
}
