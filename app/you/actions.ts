"use server";
import {revalidatePath} from "next/cache";
import {sqlite} from "@/lib/db/client";
import {backupBeforeReset,clearPersonalData,clearWorkspaces} from "@/lib/db/personal";
import {setAiProvider,type Provider} from "@/lib/ai/provider";
export async function savePreferences(data:FormData) {
 const minutes=Number(data.get("minutes")),week=Number(data.get("week")),time=String(data.get("time")),theme=String(data.get("theme"));
 if(!Number.isInteger(minutes)||minutes<5||minutes>600||![0,1].includes(week)||!["Any time","Morning","Afternoon","Evening"].includes(time)||!["system","light","dark"].includes(theme))throw Error("Check your preferences.");
 sqlite.prepare("INSERT OR REPLACE INTO preference VALUES (1,?,?,?,?)").run(minutes,time,week,theme);
 revalidatePath("/","layout");
}
export async function editFact(id:string,data:FormData) {
 if(data.get("intent")==="delete") sqlite.prepare("UPDATE profile_fact SET status='deleted',edited_at=? WHERE id=?").run(new Date().toISOString(),id);
 else {const text=String(data.get("text")||"").trim();if(!text||text.length>500)throw Error("Check the fact text.");sqlite.prepare("UPDATE profile_fact SET text=?,edited_at=? WHERE id=?").run(text,new Date().toISOString(),id);}
 revalidatePath("/you");
}
export async function deleteData(data:FormData) {
 if(data.get("confirmation")!=="DELETE")throw Error("Type DELETE to confirm.");
 const backup=backupBeforeReset();
 clearPersonalData();
 clearWorkspaces(backup.replace(/\.db$/,"-files"));
 revalidatePath("/","layout");
}
export async function chooseAi(data:FormData) {
 setAiProvider(String(data.get("ai")) as Provider);
 revalidatePath("/you");
}
