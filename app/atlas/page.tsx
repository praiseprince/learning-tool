import {AtlasPage} from "@/components/v2/atlas-page";
export default async function Atlas({searchParams}: PageProps<"/atlas">) {
  const q = await searchParams;
  return <AtlasPage goal={typeof q.goal === "string" ? q.goal : undefined} />;
}
