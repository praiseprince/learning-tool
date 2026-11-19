import {notFound} from "next/navigation";
import {projection} from "@/lib/v2/atlas";
import {requireV2} from "@/lib/v2/access";
import {sqlite} from "@/lib/db/client";
import {createNode} from "@/app/atlas/actions";
import {AtlasGraph} from "./atlas-graph";
import {V2Shell} from "./shell";
export function AtlasPage({journey}:{journey?:string}) {
 requireV2();
 const row=journey?sqlite.prepare("SELECT name FROM journey WHERE id=?").get(journey) as {name:string}|undefined:null;
 if(journey&&!row)notFound();
 const {nodes,edges}=projection(journey);
 return <V2Shell active="Atlas"><header><p className="kicker">{row?.name||"Marginalia"}</p><h1>{row?"Local atlas":"Your atlas"}</h1></header><AtlasGraph nodes={nodes} edges={edges}/>
 <details className="v2-section"><summary>Add a concept</summary><form action={createNode.bind(null,journey||"")}><label>Name<input name="label" required maxLength={160}/></label><label>Kind<select name="kind">{["concept","skill","topic","question"].map(k=><option key={k}>{k}</option>)}</select></label><label>Description<textarea name="description" maxLength={3000}/></label><button>Add to atlas</button></form></details></V2Shell>;
}
