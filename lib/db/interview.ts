import { sqlite } from "./client";
export type Stage = "goal" | "confirm" | "baseline" | "review";
export type Interview = {
  stage: Stage; turns: { stage: Stage; question: string; answer: string; inputKey?:string }[];
  question: string; pending: boolean; title: string; goal: string; criterion: string;
  summary: string; evidence: string; source: string; skill: string; level: number | null;
};
export function initialInterview(): Interview {
  return {stage:"goal", turns:[], question:"What would you like to be able to do?", pending:false,
    title:"",goal:"",criterion:"",summary:"",evidence:"",source:"",skill:"",level:null};
}
export function loadInterview(id:string) {
  const row=sqlite.prepare("SELECT revision,body,completed FROM interview WHERE id=?").get(id) as {revision:number;body:string;completed:number}|undefined;
  return row && {revision:row.revision, completed:!!row.completed, state:JSON.parse(row.body) as Interview};
}
