"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import type { Plan } from "@/lib/db/plans";
import { Button } from "@/components/ui/button";
import { finishFocus } from "@/app/j/[id]/plan/actions";

type Position = {index:number; remaining:number; deadline:number|null};
export function FocusTimer({journey,plan}:{journey:string;plan:Plan & {id:string;status:string}}) {
  const [position,setPosition]=useState<Position|null>(null);
  const [now,tick]=useState(0);
  const [hidden,hide]=useState(false);
  const key=`marginalia-focus-${plan.id}`;
  useEffect(()=>{
    const start=Date.now();
    const duration=plan.blocks[0].minutes*60;
    let saved:Position={index:0,remaining:duration,deadline:start+duration*1000};
    try {
      const value=JSON.parse(localStorage.getItem(key) || "null");
      if(value && Number.isInteger(value.index) && value.index>=0 && value.index<=plan.blocks.length && Number.isFinite(value.remaining) && (value.deadline===null || Number.isFinite(value.deadline))) saved=value;
    } catch {}
    if(plan.status==="finished") saved.index=plan.blocks.length;
    const frame=requestAnimationFrame(()=>{setPosition(saved); tick(start);});
    const timer=setInterval(()=>tick(Date.now()),500);
    return ()=>{ cancelAnimationFrame(frame); clearInterval(timer); };
  },[key,plan]);
  useEffect(()=>{ if(position) { try {localStorage.setItem(key,JSON.stringify(position));} catch {} } },[key,position]);
  const finished=position?.index===plan.blocks.length;
  useEffect(()=>{
    if(finished) return;
    let active=true;
    let lock:WakeLockSentinel|undefined;
    async function keepAwake() {
      if(document.visibilityState!=="visible" || !navigator.wakeLock) return;
      try { const next=await navigator.wakeLock.request("screen"); if(active) lock=next; else await next.release(); } catch {}
    }
    void keepAwake(); document.addEventListener("visibilitychange",keepAwake);
    return ()=>{active=false;document.removeEventListener("visibilitychange",keepAwake);void lock?.release();};
  },[finished]);
  const home=`/j/${journey}`;
  if(!position) return <main className="journey"><p>Opening session…</p></main>;
  if(finished) return <main className="journey"><h1>Session finished</h1><Link className="button button--primary" href={`${home}/log?plan=${plan.id}`}>Log it</Link> <Link className="text-link" href={home}>Skip logging</Link></main>;
  const block=plan.blocks[position.index];
  const remaining=position.deadline===null ? position.remaining : Math.max(0,Math.ceil((position.deadline-now)/1000));
  async function advance() {
    if(!position) return;
    const index=position.index+1;
    const duration=(plan.blocks[index]?.minutes??0)*60;
    if(index===plan.blocks.length) await finishFocus(journey,plan.id);
    setPosition({index,remaining:duration,deadline:Date.now()+duration*1000});
  }
  return <main className="journey"><header className="topbar"><Link className="back-link" href={home}>Close</Link><span>Block {position.index+1} of {plan.blocks.length}</span></header>
    <h1>{block.title}</h1><p className="reading">{block.instructions}</p>
    {!hidden && <p className="focus-clock">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</p>}
    <Button variant="ghost" onClick={()=>hide(!hidden)}>{hidden?"Show timer":"Hide timer"}</Button>
    <div className="cluster"><Button variant="ghost" onClick={advance}>Skip</Button>
    <Button variant="secondary" onClick={()=>setPosition({...position,remaining,deadline:position.deadline===null?Date.now()+remaining*1000:null})}>{position.deadline===null?"Resume":"Pause"}</Button>
    <Button onClick={advance}>Done</Button></div></main>;
}
