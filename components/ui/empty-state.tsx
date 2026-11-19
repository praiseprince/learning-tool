import { Button } from "./button";

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: string }) {
  return <section className="empty-state"><strong>{title}</strong><p>{detail}</p>{action && <Button variant="ghost">{action}</Button>}</section>;
}
