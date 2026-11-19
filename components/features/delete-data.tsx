"use client";
import {deleteData} from "@/app/you/actions";
import {Button} from "@/components/ui/button";
export function DeleteDataForm(){
 async function remove(data:FormData) {
  await deleteData(data);
  for(const key of Object.keys(localStorage))if(key.startsWith("marginalia-"))localStorage.removeItem(key);
  window.location.replace("/new");
 }
 return <form action={remove}><label>Type DELETE to confirm<input name="confirmation" required pattern="DELETE" autoComplete="off"/></label><Button variant="danger">Delete all data</Button></form>;
}
