import Link from "next/link";
import {notFound} from "next/navigation";
import {V2Shell} from "@/components/v2/shell";
import {requireV2} from "@/lib/v2/access";
import {sqlite} from "@/lib/db/client";
import {conversation,ensureGuide,turns,type Conversation} from "@/lib/v2/guide";
import {ensureRoutes,type Draft} from "@/lib/v2/route";
import {begin,reply,draftRoute,acceptRoute} from "./actions";
export default async function Guide({searchParams}:PageProps<"/guide">){
 requireV2();ensureGuide();ensureRoutes();
 const query=await searchParams,id=typeof query.thread==="string"?query.thread:"";
 const thread=id?conversation(id):null;
 if(id&&!thread)notFound();
 const journeys=sqlite.prepare("SELECT id,name FROM journey ORDER BY name").all() as {id:string;name:string}[];
 const proposal=thread?sqlite.prepare("SELECT id,diff_json FROM proposal WHERE kind='guide_route' AND source_ref=? AND status='pending' ORDER BY created_at DESC LIMIT 1").get(id) as {id:string;diff_json:string}|undefined:null;
 const draft=proposal?JSON.parse(proposal.diff_json).draft as Draft:null;
 const routes=thread?.context_id?sqlite.prepare("SELECT r.*,c.goal FROM learning_route r JOIN charter c ON c.id=r.charter_id WHERE r.journey_id=? ORDER BY revision DESC").all(thread.context_id) as {id:string;revision:number;goal:string;status:string}[]:[];
 const prior=routes[0]?(sqlite.prepare("SELECT content_json FROM route_step WHERE route_id=? ORDER BY position").all(routes[0].id) as {content_json:string}[]).map(s=>JSON.parse(s.content_json).title as string):[];
 const upcoming=draft?.steps.map(s=>s.title)||[];
 const messages=thread?turns(id):[];
 const recent=sqlite.prepare("SELECT * FROM guide_conversation ORDER BY updated_at DESC").all() as Conversation[];
 return <V2Shell active="Guide">{thread?<><Link href="/guide">← Conversations</Link><h1>{thread.title}</h1>
 <p>Context · {journeys.find(j=>j.id===thread.context_id)?.name||"New learning goal"}</p>
 {messages.map(t=><article key={t.id}><small>{t.role==="learner"?"You":"Guide"}</small><p className="reading">{t.raw_markdown}</p></article>)}
 {query.unavailable&&<p role="status">Your answer is saved. The Guide is unavailable.</p>}
 <form key={messages.at(-1)?.id} action={reply.bind(null,id)}><label>Your answer<textarea name="answer" maxLength={4000}/></label><button>{query.unavailable?"Continue or retry":routes.length?"Ask the Guide":"Continue interview"}</button></form>
 <form action={draftRoute.bind(null,id)}><button>{routes.length?"Propose a revised route":"Draft my route now"}</button><details><summary>Plan manually</summary><label>First step<input name="manual" maxLength={160}/></label><button>Create a manual draft</button></details></form>
 {draft&&proposal&&<section><h2>Review your proposed route</h2>{routes.length>0&&<p>Replaces revision {routes[0].revision} when approved.</p>}
 {routes.length>0&&<dl><dt>Added</dt><dd>{upcoming.filter(t=>!prior.includes(t)).join(", ")||"None"}</dd><dt>Removed</dt><dd>{prior.filter(t=>!upcoming.includes(t)).join(", ")||"None"}</dd></dl>}
 <ol className="v2-route-steps">{draft.steps.map(s=><li key={s.key}><strong>{s.title}</strong> · {s.necessity.replaceAll("_"," ")}<p>{s.reason}</p><p>{s.approach} · {s.minutes} min</p></li>)}</ol>
 <form action={acceptRoute.bind(null,id,proposal.id)}><label>Goal<textarea name="goal" defaultValue={draft.goal} required/></label><label>What success looks like<textarea name="success" defaultValue={draft.success} required/></label><label>Your starting point<textarea name="background" defaultValue={draft.background}/></label><button>Approve charter and route</button></form></section>}
 {routes.map(r=><section key={r.id}><h2>{r.goal}</h2><small>Route {r.revision} · {r.status}</small><p><Link href={"/atlas?route="+r.id}>View route in Atlas</Link></p><ol className="v2-route-steps">{(sqlite.prepare("SELECT node_id,content_json FROM route_step WHERE route_id=? ORDER BY position").all(r.id) as {node_id:string;content_json:string}[]).map(step=>{const s=JSON.parse(step.content_json);return <li key={s.key}><Link href={"/atlas/n/"+step.node_id}>{s.title}</Link> · {s.necessity.replaceAll("_"," ")}<p>{s.reason}</p><p>{s.approach} · {s.minutes} min</p></li>})}</ol></section>)}</>:<>
 <h1>Guide</h1><form action={begin}><label>What would you like to learn?<textarea name="goal" required maxLength={1500}/></label>
 <label>Journey<select name="journey"><option value="">New learning goal</option>{journeys.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select></label><button>Start a conversation</button></form>
 {recent.length>0&&<section><h2>Continue a conversation</h2>{recent.map(t=><p key={t.id}><Link href={"/guide?thread="+t.id}>{t.title}</Link></p>)}</section>}</>}</V2Shell>;
}
