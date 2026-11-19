import type { Metadata } from "next";
import { Bricolage_Grotesque, Literata } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";

const ui = Bricolage_Grotesque({ variable: "--font-ui", subsets: ["latin"] });
const reading = Literata({ variable: "--font-reading", subsets: ["latin"] });
export const metadata: Metadata = { title: APP_NAME, description: "A quiet learning companion" };
const themeScript = `(()=>{const key='marginalia-theme';const choice=localStorage.getItem(key)||'system';const set=()=>document.documentElement.dataset.theme=choice==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):choice;set();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',set)})()`;
export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="en" className={`${ui.variable} ${reading.variable}`}><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>{children}</body></html>; }
