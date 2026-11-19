import {notFound} from "next/navigation";
import Link from "next/link";
import {requireV2} from "@/lib/v2/access";
import {sqlite} from "@/lib/db/client";
import {V2Shell} from "@/components/v2/shell";
export default async function Evidence({params}:PageProps<"/atlas/e/[eventId]">){
 requireV2();const {eventId}=await params;
 const row=sqlite.prepare("SELECT v.*,s.name,s.journey_id FROM skill_event v JOIN skill s ON s.id=v.skill_id WHERE v.id=?").get(eventId) as {skill_id:string;name:string;at:string;level_after:number;delta:number;evidence_quote:string;entry_id:string;journey_id:string}|undefined;
 if(!row)notFound();
 return <V2Shell active="Atlas"><Link className="back-link" href={"/atlas/n/legacy-"+row.skill_id}>← {row.name}</Link><h1>Original skill observation</h1><p>{row.at} · Legacy skill level {row.level_after}</p><blockquote className="reading">{row.evidence_quote}</blockquote>{row.entry_id&&<Link className="text-link" href={`/j/${row.journey_id}/journal?entry=${row.entry_id}`}>Open journal entry</Link>}</V2Shell>;
}
