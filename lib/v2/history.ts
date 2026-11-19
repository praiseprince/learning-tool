import {sqlite} from "../db/client.ts";
import {ensureAtlas,type AtlasNode,type Relation,type Observation} from "./atlas.ts";

export function acceptedAt(date:string){
 ensureAtlas();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error("Choose a valid date.");
 const events=sqlite.prepare("SELECT entity, entity_id, after_json, action, recorded_at FROM graph_event WHERE recorded_at<=? ORDER BY recorded_at,rowid").all(date+"T23:59:59.999Z") as {entity:string;entity_id:string;after_json:string;action:string;recorded_at:string}[];
 const nodes=new Map<string,AtlasNode>(),relations=new Map<string,Relation>(),observations=new Map<string,Observation>();
 const redirects=new Map<string,string>();
 for(const change of events){
  const value=JSON.parse(change.after_json);
  if(change.entity==="redirect"){if(value)redirects.set(change.entity_id,value.target);else redirects.delete(change.entity_id);}
  if(change.entity==="node"){if(value)nodes.set(change.entity_id,value);else nodes.delete(change.entity_id);}
  if(change.entity==="relation"){if(value)relations.set(change.entity_id,value);else relations.delete(change.entity_id);}
  if(change.entity==="observation"){if(value)observations.set(change.entity_id,value);else observations.delete(change.entity_id);}
 }
 return {nodes:[...nodes.values()].filter(n=>!redirects.has(n.id)),edges:[...relations.values()].map(e=>({...e,source:redirects.get(e.source)||e.source,target:redirects.get(e.target)||e.target})).filter(e=>e.source!==e.target&&nodes.has(e.source)&&nodes.has(e.target)),observations:[...observations.values()].map(o=>({...o,node_id:redirects.get(o.node_id)||o.node_id})),events};
}
