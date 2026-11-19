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
 if(!row||!sqlite.prepare("UPDATE document_revision SET extraction_status='reading' WHERE id=? AND extraction_status IN ('pending','failed')").run(id).changes)return;
 try{
  const links=wikiLinks(id);
  const schema=z.object({changes:z.array(observationSuggestion).max(8)});
  const sample=links.flatMap(l=>{const quote=`[[${l.label}]]`;return row.content_md.includes(quote)?[{nodeId:l.nodeId,quote,scope:"Mentioned in a notebook revision.",kind:"encountered" as const}]:[];}).slice(0,8);
  const prompt=await readFile(join(process.cwd(),"prompts/v2/extract.md"),"utf8");
  const result=process.env.AI_PROVIDER==="stub"?{changes:sample}:await codexJson(schema,prompt+"\n"+JSON.stringify({text:row.content_md.slice(0,12000),nodes:links}));
  sqlite.transaction(()=>{
   for(const change of result.changes){
    const known=links.some(l=>l.nodeId===change.nodeId);
    const supported=known&&row.content_md.includes(change.quote);
    sqlite.prepare("INSERT INTO proposal VALUES (?,'','facet_update',?,?,?,?,NULL)").run(randomUUID(),JSON.stringify({...change,version:1,revision:id}),supported?"pending":"unsupported",id,new Date().toISOString());
   }
   sqlite.prepare("UPDATE document_revision SET extraction_status='done' WHERE id=?").run(id);
  })();
 }catch{sqlite.prepare("UPDATE document_revision SET extraction_status='failed' WHERE id=?").run(id);}
}
