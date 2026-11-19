"use client";
import {deleteData} from "@/app/you/actions";
import {Button} from "@/components/ui/button";
export function DeleteDataForm(){
 async function remove(data:FormData) {
  await deleteData(data);
  for(const key of Object.keys(localStorage))if(key.startsWith("marginalia-"))localStorage.removeItem(key);
  window.location.replace("/goals/new");
 }
 return <form action={remove} className="form"><label className="field"><span>Type DELETE to confirm</span><input name="confirmation" required pattern="DELETE" autoComplete="off"/></label><div><Button variant="danger">Reset everything</Button></div></form>;
}
