import {ReminderControl} from "@/components/features/practice-reminder";
import Link from "next/link";
import {sqlite} from "@/lib/db/client";
import {preferences} from "@/lib/db/personal";
import {Button} from "@/components/ui/button";
import {DeleteDataForm} from "@/components/features/delete-data";
import {editFact,savePreferences} from "./actions";
import {ReviewSheet} from "@/components/features/review-sheet";
export default async function You({searchParams}:PageProps<"/you">) {
 const prefs=preferences(),query=await searchParams;
 const facts=sqlite.prepare("SELECT f.id,f.text,e.occurred_on FROM profile_fact f LEFT JOIN log_entry e ON e.id=f.source_entry_id WHERE f.status='active' ORDER BY f.created_at DESC").all() as {id:string;text:string;occurred_on:string|null}[];
 return <main className="journey onboarding"><Link className="back-link" href="/">Home</Link><h1>You</h1>
 <section><h2>What I’ve noticed about you</h2>{facts.length===0&&<p className="reading">Nothing yet. I’ll note things as you log.</p>}{facts.map(f=><details key={f.id}><summary className="reading">{f.text}</summary><form action={editFact.bind(null,f.id)}><label>Fact<textarea name="text" defaultValue={f.text} required maxLength={500}/></label>{f.occurred_on&&<small>From your entry on {f.occurred_on}</small>}<div className="cluster"><Button>Save</Button><Button name="intent" value="delete" variant="ghost">Delete fact</Button></div></form></details>)}</section>
 <section><h2>Preferences</h2><form action={savePreferences}><label>Typical session minutes<input type="number" min="5" max="600" name="minutes" defaultValue={prefs.minutes} required/></label>
 <label>Preferred time of day<select name="time" defaultValue={prefs.time_of_day}>{["Any time","Morning","Afternoon","Evening"].map(v=><option key={v}>{v}</option>)}</select></label>
 <label>Week starts on<select name="week" defaultValue={prefs.week_start}><option value="1">Monday</option><option value="0">Sunday</option></select></label>
 <label>Theme<select name="theme" defaultValue={prefs.theme}>{["System","Light","Dark"].map(v=><option key={v} value={v.toLowerCase()}>{v}</option>)}</select></label><Button>Save preferences</Button></form></section>
 <section><h2>Reminders</h2><ReminderControl/></section>
 <section><h2>Your data</h2><div className="cluster"><a className="text-link" href="/api/export">Export JSON</a><a className="text-link" href="/api/export?format=markdown">Export Markdown</a></div>
 <Link className="text-link" href="/you?delete=1">Delete all data</Link></section>
 {query.delete==="1"&&<ReviewSheet home="/you"><h2>Delete all data?</h2><p>This permanently removes every journey, entry, review and preference.</p><DeleteDataForm/></ReviewSheet>}</main>;
}
