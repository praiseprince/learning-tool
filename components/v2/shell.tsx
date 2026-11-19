import Link from "next/link";
import { sqlite } from "@/lib/db/client";
import { requireV2 } from "@/lib/v2/access";
export function V2Shell({children,active}:{children:React.ReactNode;active:"Atlas"|"Guide"|"Notebook"}) {
  requireV2();
  const journeys=sqlite.prepare("SELECT id,name FROM journey WHERE status='active' ORDER BY name").all() as {id:string;name:string}[];
  return <div className="v2-shell"><aside className="v2-rail"><Link className="v2-brand" href="/">Marginalia</Link>
    <nav aria-label="Learning workspace">{["Atlas","Guide","Notebook"].map(name=><Link key={name} aria-current={active===name?"page":undefined} href={"/"+name.toLowerCase()}>{name}</Link>)}</nav>
    <div className="v2-subnav"><h2>Your journeys</h2>{journeys.map(j=><Link key={j.id} href={`/j/${j.id}/atlas`}>{j.name}</Link>)}<Link href="/you">Settings</Link></div>
  </aside><main className="v2-content">{children}</main></div>;
}
