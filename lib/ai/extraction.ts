import { z } from "zod";

export const LogExtraction = z.object({
  minutes: z.number().int().min(0).max(600).nullable(),
  kind: z.enum(["practice", "rest", "note"]),
  energy: z.enum(["low", "medium", "high"]).nullable(),
  mood: z.string().max(40).nullable(),
  skills: z.array(z.object({
    skill_id: z.string().nullable(),
    new_skill_name: z.string().max(60).nullable(),
    level_after: z.number().int().min(0).max(5),
    evidence_quote: z.string().max(160),
    note: z.string().max(140),
  })).max(8),
  obstacles: z.array(z.string().max(120)).max(4),
  wins: z.array(z.string().max(120)).max(4),
  state_note: z.string().max(240),
  clarifying_question: z.object({
    question: z.string().max(140),
    options: z.array(z.string().max(40)).min(2).max(3),
  }).nullable(),
});
