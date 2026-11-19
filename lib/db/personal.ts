import {sqlite} from "./client";
export function preferences() {
 return sqlite.prepare("SELECT minutes,time_of_day,week_start,theme FROM preference WHERE id=1").get() as {minutes:number;time_of_day:string;week_start:0|1;theme:string}|undefined ?? {minutes:30,time_of_day:"Any time",week_start:1 as const,theme:"system"};
}
export const personalTables=["rollup","extraction_answer","log_extraction","entry_time","skill_event","proposal","review","plan_item","profile_fact","state_snapshot","log_entry","skill","charter","journey","preference"] as const;
