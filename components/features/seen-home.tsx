"use client";
import {useEffect} from "react";
import {markSeen} from "@/app/j/[id]/skills/actions";
export function SeenHome({journey,at}:{journey:string;at:string}) {
 useEffect(()=>{const timer=setTimeout(()=>{if(document.visibilityState==="visible")void markSeen(journey,at);},900);return ()=>clearTimeout(timer);},[journey,at]);
 return null;
}
