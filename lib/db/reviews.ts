import { z } from "zod";
export const reviewBody=z.object({
  headline:z.string().min(1).max(100),
  insights:z.array(z.object({title:z.string().max(80),text:z.string().max(400)})).length(3),
  suggestions:z.array(z.object({field:z.enum(["goal","constraints","deadline"]),value:z.string().min(1).max(300),reason:z.string().max(240)})).max(3)
});
