"use client";
import {useState} from "react";
import { Chip } from "@/components/ui/chip";

export function PlanPreferences({initial}:{initial:number}) {
  const presets=[10,20,30,45,60];
  const [minutes,setMinutes]=useState(initial);
  const [custom,setCustom]=useState(!presets.includes(initial));
  const [energy,setEnergy]=useState("Medium");
  return <><fieldset><legend>How long?</legend><div className="cluster">{presets.map(n=><Chip key={n} type="button" selected={!custom&&minutes===n} onClick={()=>{setCustom(false);setMinutes(n);}}>{n}</Chip>)}
    <Chip type="button" selected={custom} onClick={()=>setCustom(true)}>Other</Chip></div>
    {custom?<label>Minutes<input type="number" name="minutes" min="5" max="600" defaultValue={minutes} required/></label>:<input type="hidden" name="minutes" value={minutes}/>}</fieldset>
    <fieldset><legend>How’s your energy?</legend><div className="cluster">{["Low","Medium","High"].map(option=><Chip key={option} type="button" selected={energy===option} onClick={()=>setEnergy(option)}>{option}</Chip>)}</div><input type="hidden" name="energy" value={energy}/></fieldset></>;
}
