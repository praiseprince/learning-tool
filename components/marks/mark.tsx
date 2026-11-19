import type { ReactNode } from "react";

export function Mark({ children, deep = false }: { children: ReactNode; deep?: boolean }) {
  return <mark className={`mark ${deep ? "mark--deep" : ""}`}>{children}</mark>;
}
