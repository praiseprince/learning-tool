import {refuseUnlessSignedIn} from "@/lib/signed-in";
import {sqlite} from "@/lib/db/client";
import {personalTables, workspaceFiles} from "@/lib/db/personal";
import {zip} from "@/lib/db/zip";

export async function GET(request:Request) { const no = await refuseUnlessSignedIn(); if (no) return no;
 const format=new URL(request.url).searchParams.get("format"),markdown=format==="markdown";
 const tables=personalTables().filter(table=>table!=="notebook_search");
 const snapshot=sqlite.transaction(()=>Object.fromEntries(tables.map(table=>[table,sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() as Record<string,unknown>[]])))();
 const text=markdown?["# Marginalia",...snapshot.journey.flatMap(journey=>[
  `## ${journey.name}`, ...snapshot.log_entry.filter(entry=>entry.journey_id===journey.id).map(entry=>`### ${entry.occurred_on} · ${entry.kind}\n\n${entry.raw_text}`)]),
  ...tables.filter(table=>table!=="log_entry").map(table=>`## ${table}\n\n${snapshot[table].map(row=>JSON.stringify(row)).join("\n\n")}`)].join("\n\n"):JSON.stringify(snapshot,null,2);
 if(format==="zip"){
  // everything: the data as JSON, plus every file you shared and every file the Guide made, by goal
  const body=zip([{name:"marginalia/marginalia.json",data:Buffer.from(text)},...workspaceFiles().map(f=>({name:`marginalia/${f.path}`,data:f.data,date:f.date}))]);
  return new Response(new Uint8Array(body),{headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename="marginalia-${new Date().toISOString().slice(0,10)}.zip"`,"Cache-Control":"no-store"}});
 }
 return new Response(text,{headers:{"Content-Type":markdown?"text/markdown; charset=utf-8":"application/json","Content-Disposition":`attachment; filename="marginalia.${markdown?"md":"json"}"`,"Cache-Control":"no-store"}});
}
