"use client";
import {Button} from "@/components/ui/button";
export default function ErrorState({reset}:{reset:()=>void}) {
 return <main className="journey"><h1>Something went wrong.</h1><p className="reading">Try opening this page again.</p><Button onClick={reset}>Try again</Button></main>;
}
