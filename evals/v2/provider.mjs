import { z } from "zod";
import { codexJson } from "../../lib/ai/codex.ts";

const text = z.string();
const anchor = z.object({ sourceId:text, quote:text, observedAt:text, scope:text });
const change = z.object({ action:z.enum(["link_nodes","update_facet"]), subjectId:text, objectId:text.nullable(), rationale:text, evidence:z.array(anchor), uncertainty:text.nullable() });
const step = z.object({ id:text, kind:text, title:text, nodeIds:z.array(text), necessity:z.enum(["core","helpful_context","optional_tangent"]), relevanceToGoal:text, approach:text, searchQueries:z.array(text), dependencies:z.array(text), branchId:text.nullable() });
const tasks=[
 ["interview", z.object({intent:text,nextQuestion:text.nullable(),assumptions:z.array(text),charter:z.object({outcome:text,scope:text,background:text,success:text,constraints:z.array(text)})}),"Draft a charter for exploring wave physics through piano; ask at most one question."],
 ["route", z.object({goalId:text,charterVersion:z.number().int(),rationale:text,steps:z.array(step).min(3),alternatives:z.array(z.object({label:text,tradeoff:text,entryStepIds:z.array(text)})),nextOptions:z.array(text)}),"Draft a three-step route for goal g1 version 1: understand why piano notes have overtones."],
 ["batch", z.object({sourceRevision:text,changes:z.array(change).min(2)}),"Propose two scoped changes referencing source s1 dated 2026-11-17: 'I read about harmonics. I still cannot explain resonance.' Nodes: harmonics, resonance. Quote exactly."]
];
for(const [task,schema,prompt] of tasks){
 const start=Date.now();
 const output=await codexJson(schema,prompt);
 console.log(JSON.stringify({task,valid:schema.safeParse(output).success,schemaBytes:JSON.stringify(z.toJSONSchema(schema)).length,elapsedMs:Date.now()-start}));
}
