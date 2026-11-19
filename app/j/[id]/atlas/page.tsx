import {AtlasPage} from "@/components/v2/atlas-page";
export default async function LocalAtlas({params,searchParams}:PageProps<"/j/[id]/atlas">){return <AtlasPage journey={(await params).id} filters={await searchParams}/>;}
