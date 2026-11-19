import {redirect} from "next/navigation";
import {sqlite} from "@/lib/db/client";
export const dynamic="force-dynamic";
export default function Home() {
 const journey=sqlite.prepare("SELECT id FROM journey WHERE status='active' ORDER BY last_seen_at DESC,created_at DESC LIMIT 1").get() as {id:string}|undefined;
 redirect(journey?`/j/${journey.id}`:"/new");
}
