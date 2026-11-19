"use client";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {House,BookOpen,PenLine,ChartNoAxesColumn,UserRound} from "lucide-react";
export function JourneyShell({journey,name,hue,children}:{journey:string;name:string;hue:number;children:React.ReactNode}) {
 const path=usePathname(),root=`/j/${journey}`;
 if(path.endsWith("/focus"))return children;
 const items=[
  {name:"Home",href:root,icon:House},{name:"Journal",href:root+"/journal",icon:BookOpen},{name:"Log",href:root+"/log",icon:PenLine},
  {name:"Skills",href:root+"/skills",icon:ChartNoAxesColumn},{name:"You",href:"/you",icon:UserRound}
 ];
 return <div className="journey-shell" style={{"--hue":hue} as React.CSSProperties}><nav aria-label="Main navigation" className="journey-nav">
 <Link className="rail-journey journey-pill" href={root+"?journeys=1"}><i/>{name}</Link>
 {items.map(item=><Link key={item.name} href={item.href} aria-current={path===item.href?"page":undefined} className={item.name==="Log"?"log-nav":undefined}>
 <item.icon size={22} strokeWidth={1.5}/><span>{item.name}</span></Link>)}</nav>{children}</div>;
}
