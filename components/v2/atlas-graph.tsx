"use client";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {useMemo,useState} from "react";
import {ReactFlow,Controls,Background,BackgroundVariant} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {AtlasNode,Relation} from "@/lib/v2/atlas";
export function AtlasGraph({nodes,edges}:{nodes:AtlasNode[];edges:Relation[]}) {
 const router=useRouter();
 const [query,search]=useState(""),[outline,list]=useState(false),[selected,select]=useState("");
 const matches=useMemo(()=>nodes.filter(n=>n.label.toLowerCase().includes(query.toLowerCase())),[nodes,query]);
 const visible=useMemo(()=>matches.slice(0,60),[matches]);
 const ids=new Set(visible.map(n=>n.id));
 const target=nodes.find(n=>n.id===selected);
 const links=edges.filter(e=>e.source===selected||e.target===selected);
 const positions=useMemo(()=>{
   const ordered=[...visible].sort((a,b)=>a.id.localeCompare(b.id));
   const degree=new Map<string,number>();
   for(const edge of edges){degree.set(edge.source,(degree.get(edge.source)||0)+1);degree.set(edge.target,(degree.get(edge.target)||0)+1);}
   ordered.sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0));
   const map=new Map<string,{x:number;y:number}>();
   ordered.forEach((n,i)=>{const ring=Math.ceil((Math.sqrt(i+1)-1)/2);const count=Math.max(1,8*ring);const angle=2*Math.PI*(i-(2*ring-1)**2)/count;map.set(n.id,{x:Math.cos(angle)*ring*270,y:Math.sin(angle)*ring*145});});
   return map;
 },[visible,edges]);
 return <><div className="v2-tools"><input aria-label="Search concepts" placeholder="Search concepts…" value={query} onChange={e=>search(e.target.value)}/><button onClick={()=>list(!outline)}>{outline?"Show graph":"Show outline"}</button></div>
 {!matches.length?<p className="reading">{nodes.length?"No matching concepts.":"Your atlas grows from what you explore."}</p>:outline?<ul className="v2-outline">{matches.map(n=><li key={n.id}><Link href={"/atlas/n/"+n.id}>{n.label}</Link><small>{n.kind}</small></li>)}</ul>:
 <><div className="v2-map" aria-label="Pan to explore your atlas"><ReactFlow key={query} fitView fitViewOptions={{minZoom:0.78,maxZoom:1.1,padding:0.18}} minZoom={0.15} nodesDraggable={false} nodesConnectable={false}
 nodes={visible.map(n=>({id:n.id,position:positions.get(n.id)!,selected:n.id===selected,data:{label:n.label},ariaLabel:n.kind+": "+n.label}))}
 edges={edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>({...e,label:selected&&(e.source===selected||e.target===selected)?e.kind.replaceAll("_"," "):undefined}))}
 onNodeClick={(_,n)=>select(n.id)} onNodeDoubleClick={(_,n)=>{router.push("/atlas/n/"+n.id);}}><Controls showInteractive={false}/><Background variant={BackgroundVariant.Dots} gap={32}/></ReactFlow></div>
 {matches.length>visible.length&&<small>Showing {visible.length} of {matches.length}. Search or open the outline to find another concept.</small>}</>}
 {target&&<section className="v2-inspector"><small>{target.kind} · {target.origin}</small><h2><Link href={"/atlas/n/"+target.id}>{target.label}</Link></h2><p className="reading">{target.description}</p>
 {links.slice(0,6).map(e=><p key={e.id}>{e.kind.replaceAll("_"," ")} · {nodes.find(n=>n.id===(e.source===selected?e.target:e.source))?.label}</p>)}<Link className="text-link" href={"/atlas/n/"+target.id}>Open evidence and connections →</Link></section>}</>;
}
