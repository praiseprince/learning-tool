"use client";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {Component,useMemo,useState,type ReactNode} from "react";
import dynamic from "next/dynamic";
const GraphCanvas=dynamic(()=>import("./graph-canvas"),{ssr:false});
import "@xyflow/react/dist/style.css";
import type {AtlasNode,Relation} from "@/lib/v2/atlas";
class GraphBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p>The graph could not load. Choose Show outline to explore your concepts.</p>:this.props.children;}
}
export function AtlasGraph({nodes,edges,memberships}:{nodes:AtlasNode[];edges:Relation[];memberships:{id:string;journey:string;name:string}[]}) {
 const router=useRouter();
 const [query,search]=useState(""),[outline,list]=useState(false),[selected,select]=useState(""),[focus,setFocus]=useState("");
 const neighborhood=useMemo(()=>{
  if(!focus)return null;
  const ids=new Set([focus]);
  for(const edge of edges)if(edge.source===focus||edge.target===focus){ids.add(edge.source);ids.add(edge.target);}
  return ids;
 },[focus,edges]);
 const matches=useMemo(()=>nodes.filter(n=>(!neighborhood||neighborhood.has(n.id))&&n.label.toLowerCase().includes(query.toLowerCase())),[nodes,query,neighborhood]);
 const visible=useMemo(()=>matches.slice(0,60),[matches]);
 const ids=new Set(visible.map(n=>n.id));
 const target=nodes.find(n=>n.id===selected);
 const links=edges.filter(e=>e.source===selected||e.target===selected);
 const clusters=useMemo(()=>{
  const groups=new Map<string,Set<string>>();
  for(const m of memberships){const ids=groups.get(m.name)||new Set<string>();ids.add(m.id);groups.set(m.name,ids);}
  return groups;
 },[memberships]);
 const positions=useMemo(()=>{
   const ordered=[...visible].sort((a,b)=>a.id.localeCompare(b.id));
   const degree=new Map<string,number>();
   for(const edge of edges){degree.set(edge.source,(degree.get(edge.source)||0)+1);degree.set(edge.target,(degree.get(edge.target)||0)+1);}
   ordered.sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0));
   const map=new Map<string,{x:number;y:number}>();
   ordered.forEach((n,i)=>{const ring=Math.ceil((Math.sqrt(i+1)-1)/2);const count=Math.max(1,8*ring);const angle=2*Math.PI*(i-(2*ring-1)**2)/count;map.set(n.id,{x:Math.cos(angle)*ring*270,y:Math.sin(angle)*ring*145});});
   if(clusters.size>1){
    const placed=new Set<string>();
    let x=0;
    for(const ids of clusters.values()){
     const group=ordered.filter(n=>ids.has(n.id)&&!placed.has(n.id));
     const columns=Math.max(1,Math.ceil(Math.sqrt(group.length)));
     group.forEach((n,i)=>{placed.add(n.id);map.set(n.id,{x:x+(i%columns)*220,y:Math.floor(i/columns)*100});});
     if(group.length)x+=(columns+1)*220;
    }
    ordered.filter(n=>!placed.has(n.id)).forEach((n,i)=>map.set(n.id,{x,y:i*100}));
   }
   return map;
 },[visible,edges,clusters]);
 return <>{clusters.size>1&&<details><summary>Journey neighborhoods · {clusters.size}</summary>{[...clusters].map(([name,ids])=><p key={name}><Link href={`/j/${memberships.find(m=>m.name===name)!.journey}/atlas`}>{name}</Link> · {ids.size} concepts</p>)}</details>}<div className="v2-tools"><input aria-label="Search concepts" placeholder="Search concepts…" value={query} onChange={e=>search(e.target.value)}/><button onClick={()=>list(!outline)}>{outline?"Show graph":"Show outline"}</button>{focus&&<button onClick={()=>setFocus("")}>Show all concepts</button>}</div>
 {!matches.length?<p className="reading">{nodes.length?"No matching concepts.":"Your atlas grows from what you explore."}</p>:outline?<ul className="v2-outline">{matches.map(n=><li key={n.id}><Link href={"/atlas/n/"+n.id}>{n.label}</Link><small>{n.kind}</small></li>)}</ul>:
 <><div className="v2-map" aria-label="Pan to explore your atlas"><GraphBoundary><GraphCanvas key={query+focus} fitView fitViewOptions={{minZoom:0.78,maxZoom:1.1,padding:0.18}} minZoom={0.15} nodesDraggable={false} nodesConnectable={false}
 nodes={visible.map(n=>({id:n.id,position:positions.get(n.id)!,selected:n.id===selected,data:{label:n.label},ariaLabel:n.kind+": "+n.label}))}
 edges={edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>({...e,label:selected&&(e.source===selected||e.target===selected)?e.kind.replaceAll("_"," "):undefined}))}
 onNodeClick={(_,n)=>select(n.id)} onNodeDoubleClick={(_,n)=>{router.push("/atlas/n/"+n.id);}}/></GraphBoundary></div>
 {matches.length>visible.length&&<small>Showing {visible.length} of {matches.length}. Search or open the outline to find another concept.</small>}</>}
 {target&&<section className="v2-inspector"><small>{target.kind} · {target.origin}</small><h2><Link href={"/atlas/n/"+target.id}>{target.label}</Link></h2><p className="reading">{target.description}</p>
 {links.length>0&&!focus&&<button onClick={()=>{setFocus(target.id);search("");}}>Focus connected concepts</button>}
 {links.slice(0,6).map(e=><p key={e.id}>{e.kind.replaceAll("_"," ")} · {nodes.find(n=>n.id===(e.source===selected?e.target:e.source))?.label}<br/><small>{e.rationale}</small></p>)}<Link className="text-link" href={"/atlas/n/"+target.id}>Open evidence and connections →</Link></section>}</>;
}
