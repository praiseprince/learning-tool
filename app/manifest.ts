import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest {
 return {name:"Marginalia",short_name:"Marginalia",description:"Your personal learning journal",start_url:"/",scope:"/",display:"standalone",icons:[192,512].map(size=>({src:`/marginalia-${size}.png`,sizes:`${size}x${size}`,type:"image/png"}))};
}
