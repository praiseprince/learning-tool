"use client";
import {useEffect,useRef,useState} from "react";
import {saveRevision} from "@/app/notebook/actions";
import {Markdown} from "./markdown";
import type {WikiLink} from "@/lib/v2/notebook";
export function Editor({id,initial,title:original,revision,links,nodes}:{id:string;initial:string;title:string;revision:string;links:WikiLink[];nodes:{id:string;label:string}[]}){
 const [title,setTitle]=useState(original),[body,setBody]=useState(initial),[preview,show]=useState(false),[status,setStatus]=useState("Saved"),[retry,again]=useState(0);
 const [caret,setCaret]=useState(0);
 const base=useRef(revision),saved=useRef({title:original,body:initial}),busy=useRef(false),area=useRef<HTMLTextAreaElement>(null);
 const key="marginalia-document-"+id;
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{try{const draft=JSON.parse(localStorage.getItem(key)||"null");if(draft&&typeof draft.body==="string"&&typeof draft.title==="string"){setBody(draft.body);setTitle(draft.title);base.current=draft.base;}}catch{}});
  return ()=>cancelAnimationFrame(frame);
 },[key]);
 useEffect(()=>{
  if(title===saved.current.title&&body===saved.current.body)return;
  const timer=setTimeout(async()=>{
   if(busy.current)return;
   busy.current=true;setStatus("Saving…");
   try{
    const next=await saveRevision(id,base.current,title,body);saved.current={title,body};base.current=next;
    const raw=localStorage.getItem(key);
    if(raw){const latest=JSON.parse(raw);if(latest.body===body&&latest.title===title)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify({...latest,base:next}));}
    setStatus("Saved");again(n=>n+1);
   }catch{setStatus("Couldn’t save. Your draft is on this device. Reopen the current revision before merging conflicting edits.");}
   finally{busy.current=false;}
  },750);
  return ()=>clearTimeout(timer);
 },[id,title,body,key,retry]);
 function edit(nextTitle:string,nextBody:string){
  localStorage.setItem(key,JSON.stringify({title:nextTitle,body:nextBody,base:base.current}));setTitle(nextTitle);setBody(nextBody);setStatus("Unsaved draft");
 }
 const fragment=body.slice(0,caret).match(/\[\[([^\]\n]*)$/)?.[1];
 return <><label>Title<input value={title} maxLength={240} onChange={e=>edit(e.target.value,body)}/></label>
 <div className="v2-tools"><button onClick={()=>show(!preview)}>{preview?"Edit Markdown":"Preview"}</button><small role="status">{status}</small>{status.startsWith("Couldn’t")&&<button onClick={()=>again(n=>n+1)}>Try again</button>}</div>
 {preview?<Markdown text={body} links={[...nodes.map(n=>({label:n.label,nodeId:n.id})),...links]}/>:<><label>Notebook page<textarea ref={area} onSelect={e=>setCaret(e.currentTarget.selectionStart)} className="v2-writing" value={body} maxLength={120000} onChange={e=>edit(title,e.target.value)} placeholder="Write a note…"/></label>
 {fragment!==undefined&&<div className="v2-tools">{nodes.filter(n=>n.label.toLowerCase().includes(fragment.toLowerCase())).slice(0,6).map(n=><button key={n.id} onClick={()=>{const at=area.current?.selectionStart??body.length;edit(title,body.slice(0,at-fragment.length)+n.label+"]]"+body.slice(at));}}>{n.label}</button>)}</div>}</>}
 </>;
}
