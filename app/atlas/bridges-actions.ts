"use server";
import {instruction} from "@/lib/v2/prompts";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {requireV2} from "@/lib/v2/access";
import {codexJson} from "@/lib/ai/codex";
import {mergeConcept,addAlias,candidates,recordBridge,decideBridge} from "@/lib/v2/bridges";
export async function findBridges(){
 requireV2();
 const schema=z.object({meaning:z.enum(["same concept","analogy","application","similar wording"]),rationale:z.string().min(10).max(1200)});
 let failed=false;
 for(const pair of candidates()){
  try{
   const result=process.env.AI_PROVIDER==="stub"?{meaning:"analogy",rationale:`Both topics use “${pair.label}”. Compare how each describes it: ${pair.firstContext||pair.first} / ${pair.secondContext||pair.second}.`}:await codexJson(schema,await instruction("bridge")+"\n"+JSON.stringify(pair));
   if(result.meaning!=="similar wording")recordBridge(pair,result.rationale,result.meaning);
  }catch{failed=true;break;}
 }
 redirect("/notebook/inbox"+(failed?"?provider=failed":""));
}
export async function reviewBridge(id:string,data:FormData){
 requireV2();decideBridge(id,String(data.get("intent")),String(data.get("rationale")||""),String(data.get("kind")||"cross_domain_bridge"));
 revalidatePath("/notebook/inbox");
}
export async function nameAlias(node:string,data:FormData){
 requireV2();addAlias(node,String(data.get("label")||""));revalidatePath("/atlas/n/"+node);
}

export async function confirmMerge(source:string,data:FormData){
 requireV2();
 if(data.get("confirmed")!=="yes")throw Error("Confirm the merge before saving.");
 const target=String(data.get("target")||"");mergeConcept(source,target);
 redirect("/atlas/n/"+target);
}
export async function undoMerge(source:string,target:string){
 requireV2();mergeConcept(source,target,true);redirect("/atlas/n/"+source);
}
