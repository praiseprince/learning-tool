import {AtlasPage} from "@/components/v2/atlas-page";
export default async function Atlas({searchParams}:PageProps<"/atlas">){return <AtlasPage filters={await searchParams}/>;}
