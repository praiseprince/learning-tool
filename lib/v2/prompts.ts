import {readFile} from "node:fs/promises";
import {join} from "node:path";
type Task="extract"|"bridge";
export async function instruction(task:Task){
 return readFile(join(process.cwd(),"prompts","v2",task+".md"),"utf8");
}
