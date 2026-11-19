"use client";
import {useEffect} from "react";
export function AppPreferences({theme}:{theme:string}) {
 useEffect(()=>{
  const media=matchMedia("(prefers-color-scheme: dark)");
  const update=()=>{document.documentElement.dataset.theme=theme==="system"?(media.matches?"dark":"light"):theme;};
  update();media.addEventListener("change",update);
  return ()=>media.removeEventListener("change",update);
 },[theme]);
 useEffect(()=>{if(process.env.NODE_ENV==="production" && "serviceWorker" in navigator && window.isSecureContext)void navigator.serviceWorker.register("/sw.js").catch(()=>undefined);},[]);
 return null;
}
