export type GoalDraft = { name: string; goal: string; why: string; doneLooksLike: string; startingPoint: string; skills: { name: string; level: number }[] };
export function draftJourney(intent: string, startingPoint: string): GoalDraft {
  const subject = intent.split(/[,.!?]/)[0].replace(/^(i want to|learn to|learn)/i, "").trim() || "My learning";
  return { name: subject.replace(/\b\w/g, (letter) => letter.toUpperCase()), goal: intent, why: "You want a practice that fits into the life you have now.", doneLooksLike: "You can do the thing you set out to learn with steadiness and confidence.", startingPoint: startingPoint || "Starting from where you are today.", skills: ["Foundations", "Practice rhythm", "Core technique", "Applying what you know"].map((name, index) => ({ name, level: index === 0 ? 1 : 0 })) };
}
