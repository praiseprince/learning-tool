import {refuseUnlessSignedIn} from "@/lib/signed-in";
import {requireV2} from "@/lib/v2/access";
import {documentById,revisionById,wikiLinks} from "@/lib/v2/notebook";
export async function GET(_:Request,{params}:RouteContext<"/notebook/d/[id]/export">){ const no = await refuseUnlessSignedIn(); if (no) return no;
 requireV2();const doc=documentById((await params).id);if(!doc)return new Response(null,{status:404});
 const revision=revisionById(doc.current_revision_id)!;
 const meta={id:doc.id,title:doc.title,revision:revision.id,links:wikiLinks(revision.id)};
 return new Response("---\n"+Object.entries(meta).map(([k,v])=>k+": "+JSON.stringify(v)).join("\n")+"\n---\n"+revision.content_md,{headers:{"content-type":"text/markdown; charset=utf-8","content-disposition":`attachment; filename="note-${doc.id}.md"`,"cache-control":"no-store"}});
}
