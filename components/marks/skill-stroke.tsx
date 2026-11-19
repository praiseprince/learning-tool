const levelNames = ["Not started", "Aware", "Attempting", "Getting there", "Reliable", "Second nature"];

export function SkillStroke({ level, evidence = "building", moved = false, compact = false }: { level: number; evidence?: "penciled" | "building" | "inked"; moved?: boolean; compact?: boolean }) {
  const percentage = Math.max(0, Math.min(5, level)) * 20;
  return <span className={`skill-stroke skill-stroke--${evidence} ${compact ? "skill-stroke--compact" : ""}`} role="img" aria-label={`${levelNames[level]}, level ${level} of 5, ${evidence} evidence`}>
    <span className="skill-stroke__ticks" />
    <span className="skill-stroke__fill" style={{ width: `${percentage}%` }} />
    {moved && level > 0 && <span className="skill-stroke__moved" style={{ left: `${Math.max(0, percentage - 18)}%`, width: `${Math.min(18, percentage)}%` }} />}
  </span>;
}

export function SkillRow({ name, level, evidence = "building", moved = false }: { name: string; level: number; evidence?: "penciled" | "building" | "inked"; moved?: boolean }) {
  return <div className="skill-row"><div><div>{name}</div><small>{levelNames[level]}</small></div><SkillStroke level={level} evidence={evidence} moved={moved} /></div>;
}
