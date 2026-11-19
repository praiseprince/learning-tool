"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
const key="marginalia-reminder";
export function ReminderControl() {
 const [time,setTime]=useState("");
 useEffect(()=>{const frame=requestAnimationFrame(()=>setTime(localStorage.getItem(key)||""));return ()=>cancelAnimationFrame(frame);},[]);
 return <input type="time" aria-label="Daily reminder time" value={time} onChange={e=>{setTime(e.target.value);localStorage.setItem(key,e.target.value);window.dispatchEvent(new Event(key));}}/>;
}
export function PracticeReminder() {
 const [due,setDue]=useState(false);
 useEffect(()=>{
  function check(){
   const time=localStorage.getItem(key),now=new Date();
   const clock=[now.getHours(),now.getMinutes()].map(n=>String(n).padStart(2,"0")).join(":");
   if(time===clock && localStorage.getItem(key+"-seen")!==now.toDateString()){
     localStorage.setItem(key+"-seen",now.toDateString());setDue(true);
   }
  }
  const timer=setInterval(check,15000);window.addEventListener(key,check);
  return ()=>{clearInterval(timer);window.removeEventListener(key,check);};
 },[]);
 if(!due)return null;
 return <aside className="form-note" style={{position:"fixed",top:16,right:16,zIndex:60,maxWidth:360,boxShadow:"var(--pop)"}} role="status">Time for your daily practice. <Link className="link" href="/" onClick={()=>setDue(false)}>Open Today</Link> <button className="btn btn--text" onClick={()=>setDue(false)}>Dismiss</button></aside>;
}
