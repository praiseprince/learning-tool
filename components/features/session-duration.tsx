"use client";
import { useEffect,useRef,useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ui/chip";
import { changeDuration } from "@/app/j/[id]/plan/actions";

export function SessionDuration({journey,minutes}:{journey:string;minutes:number}) {
  const [selected,select]=useState(minutes);
  const [custom,showCustom]=useState(![15,30,60].includes(minutes));
  const [error,setError]=useState("");
  const [pending,start]=useTransition();
  const timeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const router=useRouter();
  useEffect(()=>()=>clearTimeout(timeout.current),[]);
  function choose(value:number) {
    select(value);
    clearTimeout(timeout.current);
    if(!Number.isInteger(value)||value<5||value>600) return;
    timeout.current=setTimeout(()=>start(async()=>{
      setError("");
      try {await changeDuration(journey,value);router.refresh();}
      catch {setError("Couldn’t update the plan. Choose a duration to try again.");}
    }),350);
  }
  return <><div className="cluster">{[15,30,60].map(n=><Chip key={n} selected={!custom&&selected===n} disabled={pending} onClick={()=>{showCustom(false);choose(n);}}>{n}</Chip>)}
    <Chip selected={custom} disabled={pending} onClick={()=>showCustom(!custom)}>Other</Chip></div>
    {custom && <label>Minutes <input aria-label="Session minutes" type="number" min={5} max={600} value={selected || ""} disabled={pending} onChange={event=>choose(Number(event.target.value))}/></label>}
    {pending && <small role="status">Updating your plan…</small>}{error && <p role="alert">{error}</p>}</>;
}
