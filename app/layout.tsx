import {PracticeReminder} from "@/components/features/practice-reminder";
import {preferences} from "@/lib/db/personal";
import {AppPreferences} from "@/components/features/app-preferences";
import type { Metadata,Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import "./theme.css";
import { APP_NAME } from "@/lib/constants";

const ui = Instrument_Sans({ variable: "--font-ui", subsets: ["latin"] });
const reading = Newsreader({ variable: "--font-reading", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"] });
export const metadata: Metadata = { title: APP_NAME, description: "A quiet learning companion", icons:{apple:"/marginalia-192.png",icon:"/marginalia-192.png"} };
export const dynamic="force-dynamic";
export const viewport:Viewport={viewportFit:"cover",width:"device-width",initialScale:1,interactiveWidget:"resizes-content",themeColor:[{media:"(prefers-color-scheme: light)",color:"#F3F4F1"},{media:"(prefers-color-scheme: dark)",color:"#0B0E0D"}]};
export default function RootLayout({children}:LayoutProps<"/">) {
 const {theme}=preferences();
 return <html lang="en" data-theme={theme} className={`${ui.variable} ${reading.variable}`}><body><AppPreferences theme={theme}/>{children}<PracticeReminder/></body></html>;
}
