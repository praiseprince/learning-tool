import { redirect } from "next/navigation";
import { findPlan } from "@/lib/db/plans";
import { FocusTimer } from "@/components/features/focus-timer";

export default async function Focus({params,searchParams}:PageProps<"/j/[id]/focus">) {
  const {id}=await params;
  const plan=findPlan(id,(await searchParams).plan);
  if (!plan) redirect(`/j/${id}/plan`);
  return <FocusTimer key={plan.id} journey={id} plan={plan}/>;
}
