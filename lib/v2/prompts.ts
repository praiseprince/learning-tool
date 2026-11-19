import {readFile} from "node:fs/promises";
import {join} from "node:path";
type Task="interview"|"charter"|"route"|"replan"|"guide"|"extract"|"bridge"|"resource"|"summary";
export async function instruction(task:Task){
 return readFile(join(process.cwd(),"prompts","v2",task+".md"),"utf8");
}
