import {getJourney} from "@/lib/db/queries";
import {notFound} from "next/navigation";
import {JourneyShell} from "@/components/features/journey-shell";
export default async function Layout({params,children}:LayoutProps<"/j/[id]">) {
 const {id}=await params,journey=await getJourney(id);
 if(!journey)notFound();
 return <JourneyShell journey={id} name={journey.name} hue={journey.hue}>{children}</JourneyShell>;
}
