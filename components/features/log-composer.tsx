"use client";
import {useEffect,useRef,useState} from "react";
import {Mic} from "lucide-react";
import {Button} from "@/components/ui/button";

type Recognition = {
 lang:string;interimResults:boolean;
 onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
 onend:(()=>void)|null;onerror:(()=>void)|null;start():void;abort():void;
};
type SpeechWindow=Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export function LogComposer({save,date,text,minutes}:{save:(data:FormData)=>Promise<void>;date:string;text:string;minutes?:number}) {
 const [note,setNote]=useState(text),[listening,setListening]=useState(false),[message,setMessage]=useState("");
 const recorder=useRef<Recognition|null>(null);
 useEffect(()=>()=>{recorder.current?.abort();},[]);
 function dictate(){
  if(listening){recorder.current?.abort();return;}
  const speech=window as SpeechWindow,Recognition=speech.SpeechRecognition??speech.webkitSpeechRecognition;
  if(!Recognition){setMessage("Use the microphone on your keyboard to dictate an entry.");return;}
  const instance=new Recognition();recorder.current=instance;
  instance.lang=document.documentElement.lang || "en";instance.interimResults=false;
  instance.onresult=event=>{
   const words=Array.from(event.results).map(result=>result[0]?.transcript).filter(Boolean).join(" ");
   setNote(old=>[old.trimEnd(),words].filter(Boolean).join(" ").slice(0,8000));
  };
  instance.onend=()=>setListening(false);
  instance.onerror=()=>{setMessage("Couldn’t hear that. Try again or type your entry.");setListening(false);};
  try {instance.start();setListening(true);setMessage("");} catch {instance.onerror();}
 }
 return <form action={save}>
 <label>Session date<input type="date" name="date" required defaultValue={date} max={date}/></label>
 <label>What did you do?<textarea value={note} onChange={e=>setNote(e.target.value)} name="note" maxLength={8000} placeholder="What clicked, or where did you get stuck?"/></label>
 <Button type="button" variant="ghost" aria-pressed={listening} onClick={dictate}><Mic size={22} strokeWidth={1.5}/>{listening?"Stop dictation":"Dictate"}</Button>{message&&<small role="status">{message}</small>}
 <label>Minutes (optional)<input defaultValue={minutes} name="minutes" type="number" min="0" max="600"/></label>
 <label>Energy<select name="energy" defaultValue=""><option value="">Unspecified</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
 <Button disabled={!note.trim()}>Save entry</Button><Button variant="ghost" name="kind" value="rest" formNoValidate>Log a rest day</Button></form>;
}
