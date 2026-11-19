import {z} from "zod";
export const JourneyDraft=z.object({
 name:z.string().min(1).max(100),goal:z.string().min(1).max(1500),why:z.string().max(1200),doneLooksLike:z.string().max(1200),startingPoint:z.string().max(1200),
 skills:z.array(z.object({name:z.string().min(1).max(100),level:z.number().int().min(0).max(5)})).min(1).max(24)
});
