import {sqlite} from "@/lib/db/client";
import {personalTables} from "@/lib/db/personal";

export async function GET(request:Request) {
 const markdown=new URL(request.url).searchParams.get("format")==="markdown";
 const snapshot=sqlite.transaction(()=>Object.fromEntries(personalTables.map(table=>[table,sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() as Record<string,unknown>[]])))();
 const text=markdown?["# Marginalia",...snapshot.journey.flatMap(journey=>[
  `## ${journey.name}`, ...snapshot.log_entry.filter(entry=>entry.journey_id===journey.id).map(entry=>`### ${entry.occurred_on} · ${entry.kind}\n\n${entry.raw_text}`)]),
  ...personalTables.filter(table=>table!=="log_entry").map(table=>`## ${table}\n\n${snapshot[table].map(row=>JSON.stringify(row)).join("\n\n")}`)].join("\n\n"):JSON.stringify(snapshot,null,2);
 return new Response(text,{headers:{"Content-Type":markdown?"text/markdown; charset=utf-8":"application/json","Content-Disposition":`attachment; filename="marginalia.${markdown?"md":"json"}"`,"Cache-Control":"no-store"}});
}
