import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {z} from "zod";
import {sqlite} from "../db/client";
import {codexJson} from "../ai/codex";
import {revisionById,wikiLinks} from "./notebook";
export const observationSuggestion=z.object({nodeId:z.string().min(1),quote:z.string().min(1).max(400),scope:z.string().min(1).max(500),kind:z.enum(["encountered","self_report","explanation_in_own_words","worked_example","successful_application","difficulty_report","source_annotation"])});
export async function extractRevision(id:string){
 const row=revisionById(id);
 const lease=new Date(Date.now()+180000).toISOString();
 if(!row||!sqlite.prepare("UPDATE document_revision SET extraction_status='reading',lease_until=? WHERE id=? AND (extraction_status IN ('pending','failed') OR (extraction_status='reading' AND lease_until<?))").run(lease,id,new Date().toISOString()).changes)return;
 try{
  const links=wikiLinks(id);
  const plainMatches=sqlite.prepare("SELECT id AS nodeId,label FROM atlas_node WHERE length(trim(label))>=4 AND instr(lower(?),lower(label))>0 ORDER BY length(label) DESC LIMIT 16").all(row.content_md.slice(0,12000)) as {nodeId:string;label:string}[];
  for(const match of plainMatches)if(!links.some(link=>link.nodeId===match.nodeId))links.push(match);
  const newConcept=z.object({label:z.string().trim().min(1).max(160),quote:z.string().min(1).max(400),scope:z.string().min(1).max(500)});
  const schema=z.object({changes:z.array(observationSuggestion).max(8),concepts:z.array(newConcept).max(4)});
  const sample=links.flatMap(l=>{const label=l.label,wrapped=`[[${label}]]`,at=row.content_md.toLowerCase().indexOf(label.toLowerCase()),quote=row.content_md.includes(wrapped)?wrapped:at>=0?row.content_md.slice(at,at+label.length):"";return quote?[{nodeId:l.nodeId,quote,scope:"Mentioned in a notebook revision.",kind:"encountered" as const}]:[];}).slice(0,8);
  const prompt=await readFile(join(process.cwd(),"prompts/v2/extract.md"),"utf8");
  const result=process.env.AI_PROVIDER==="stub"?{changes:sample,concepts:[...row.content_md.matchAll(/\[\[([^\]\n]{1,160})\]\]/g)].filter(m=>!links.some(l=>l.label.toLowerCase()===m[1].trim().toLowerCase())).slice(0,4).map(m=>({label:m[1].trim(),quote:m[0],scope:"A concept named in your note."}))}:await codexJson(schema,prompt+"\n"+JSON.stringify({text:row.content_md.slice(0,12000),nodes:links}));
  sqlite.transaction(()=>{
   if(!sqlite.prepare("SELECT 1 FROM document_revision WHERE id=? AND lease_until=?").get(id,lease))return;
   for(const concept of result.concepts){
    if(!concept.label||sqlite.prepare("SELECT 1 FROM atlas_node WHERE label=? COLLATE NOCASE").get(concept.label))continue;
    const change={...concept,nodeId:randomUUID(),kind:"encountered",newConcept:true,version:1,revision:id};
    sqlite.prepare("INSERT INTO proposal VALUES (?,'','facet_update',?,?,?,?,NULL)").run(randomUUID(),JSON.stringify(change),row.content_md.includes(change.quote)?"pending":"unsupported",id,new Date().toISOString());
   }
   for(const change of result.changes){
    const known=links.some(l=>l.nodeId===change.nodeId);
    const supported=known&&row.content_md.includes(change.quote);
    sqlite.prepare("INSERT INTO proposal VALUES (?,'','facet_update',?,?,?,?,NULL)").run(randomUUID(),JSON.stringify({...change,version:1,revision:id}),supported?"pending":"unsupported",id,new Date().toISOString());
   }
   sqlite.prepare("UPDATE document_revision SET extraction_status='done',lease_until=NULL WHERE id=?").run(id);
  })();
 }catch{sqlite.prepare("UPDATE document_revision SET extraction_status='failed',lease_until=NULL WHERE id=? AND lease_until=?").run(id,lease);}
}
