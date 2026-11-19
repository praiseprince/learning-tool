"use client";

import { useState } from "react";

type Block = { title: string; minutes: number; instructions: string; why?: string };
export function SessionBlocks({ blocks }: { blocks: Block[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return <div className="session-blocks">{blocks.map((block, index) => {
    const start = blocks.slice(0, index).reduce((total, previous) => total + previous.minutes, 0);
    return <div className="session-block" key={block.title}><button onClick={() => setOpen(open === index ? null : index)} aria-expanded={open === index}><span className="session-block__offset">{Math.floor(start / 60)}:{String(start % 60).padStart(2, "0")}</span><span>{block.title}</span><small>{block.minutes} min</small></button>{open === index && <p>{block.instructions}{block.why && <> {block.why}</>}</p>}</div>;
  })}</div>;
}
