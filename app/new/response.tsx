"use client";
import {useEffect,useState} from "react";
import {useFormStatus} from "react-dom";
import {Button} from "@/components/ui/button";
export function InterviewAnswer({storageKey}:{storageKey:string}) {
  const [text,setText]=useState("");
  const {pending}=useFormStatus();
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>setText(localStorage.getItem("marginalia-"+storageKey)??""));
    return ()=>cancelAnimationFrame(frame);
  },[storageKey]);
  return <><label>Your answer<textarea required maxLength={2000} name="answer" value={text} placeholder="Write in your own words…" onChange={event=>{
    setText(event.target.value);localStorage.setItem("marginalia-"+storageKey,event.target.value);
  }}/></label><Button disabled={pending||!text.trim()}>{pending?"Reading your answer…":"Continue"}</Button></>;
}


export function ClearSavedAnswer({storageKey,answer}:{storageKey:string;answer:string}) {
  useEffect(()=>{
    const key="marginalia-"+storageKey;
    if(localStorage.getItem(key)?.trim()===answer) localStorage.removeItem(key);
  },[storageKey,answer]);
  return null;
}
