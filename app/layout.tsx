import {preferences} from "@/lib/db/personal";
import {AppPreferences} from "@/components/features/app-preferences";
import type { Metadata,Viewport } from "next";
import { Bricolage_Grotesque, Literata } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";

const ui = Bricolage_Grotesque({ variable: "--font-ui", subsets: ["latin"] });
const reading = Literata({ variable: "--font-reading", subsets: ["latin"] });
export const metadata: Metadata = { title: APP_NAME, description: "A quiet learning companion", icons:{apple:"/marginalia-192.png",icon:"/marginalia-192.png"} };
export const dynamic="force-dynamic";
export const viewport:Viewport={viewportFit:"cover",width:"device-width",initialScale:1};
export default function RootLayout({children}:LayoutProps<"/">) {
 const {theme}=preferences();
 return <html lang="en" data-theme={theme} className={`${ui.variable} ${reading.variable}`}><body><AppPreferences theme={theme}/>{children}</body></html>;
}
