import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Mark } from "@/components/marks/mark";
import { SkillRow, SkillStroke } from "@/components/marks/skill-stroke";
import { Sparkline } from "@/components/marks/sparkline";
import { WeekLines } from "@/components/marks/week-lines";
import { SessionBlocks } from "@/components/features/session-blocks";

const week = [{ label: "Mon", minutes: 25 }, { label: "Tue", minutes: 40 }, { label: "Wed", rest: true }, { label: "Thu", today: true }, { label: "Fri", future: true }, { label: "Sat", future: true }, { label: "Sun", future: true }];

export default function Styleguide() {
  return <main className="styleguide"><header><p className="kicker">Marginalia</p><h1>Quiet pieces, made to be used.</h1><p className="reading">The interface is paper and ink. Highlighter only tells you what has moved.</p></header>
    <section><h2>Buttons and chips</h2><div className="cluster"><Button>Start session</Button><Button variant="secondary">Plan today</Button><Button variant="ghost">Keep entry only</Button><Button variant="danger">Archive journey</Button><Button disabled>Save entry</Button></div><div className="cluster"><Chip>15</Chip><Chip selected>30</Chip><Chip>60</Chip><Chip disabled>Other</Chip></div></section>
    <section><h2>Progress marks</h2><p className="reading">Your entry is saved. <Mark>Bar 12 is still the snag</Mark>, but <Mark deep>reading has got steadier</Mark>.</p><div className="stroke-list"><SkillStroke level={2} evidence="penciled" /><SkillStroke level={3} evidence="building" /><SkillStroke level={4} evidence="inked" moved /></div></section>
    <section><h2>This week</h2><WeekLines days={week} plannedMinutes={30} /></section>
    <section><h2>Skills</h2><SkillRow name="Left hand, bar 12" level={2} evidence="penciled" /><SkillRow name="Sight-reading" level={3} evidence="building" moved /><SkillRow name="Scales" level={4} evidence="inked" /></section>
    <section><h2>Today&apos;s session</h2><SessionBlocks blocks={[{ title: "Warm-up scales", minutes: 5, instructions: "Slow scales, keeping your wrist loose." }, { title: "Bar 12, left hand", minutes: 15, instructions: "Hands separate. Stop at the first stumble." }, { title: "Play-through", minutes: 10, instructions: "One unbroken, unhurried pass." }]} /></section>
    <section><h2>History, loading and empty</h2><Sparkline /><div className="skeleton-row"><Skeleton /><Skeleton /><Skeleton /></div><EmptyState title="Nothing here yet." detail="Your entries will appear here." action="Write an entry" /></section>
  </main>;
}
