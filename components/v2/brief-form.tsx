"use client";
import {useState} from "react";

const EXAMPLE = `# Piano: sing and play chords

I want to accompany myself on piano while singing, so I can perform three songs at my sister's wedding next April.

## Where I am now
- Major triads (C, F, G): I can play them in root position, both hands separately
- Reading the treble clef slowly; bass clef barely
- Singing in tune on easy songs when my hands are not busy
I lose the pitch as soon as my left hand has to change chords.

## Long-term, what I eventually want
- Smooth chord changes with inversions
- Minor and seventh chords
- Steady rhythm with a metronome
- Breath support and a comfortable vocal range
- Singing while playing chords
- Transposing a song to fit my voice

## Roadmap
### Month 1
Chords and pulse
- Play C, F, G, Am, Dm, Em cleanly
- Keep a steady pulse at 60 bpm
### Month 2
Chord changes
- Change between four chords without stopping
### Month 3
Add the voice
- Sing the melody over the left hand

## Constraints
30 minutes on weekdays, longer on Sundays. Upright piano, headphones after 9 pm. Small hands.`;

export function BriefForm({action, notice}: {action: (data: FormData) => void | Promise<void>; notice?: string}) {
  const [text, setText] = useState("");
  return <form action={action} className="form">
    <label className="field"><span>Your brief</span>
    <textarea name="brief" value={text} onChange={e => setText(e.target.value)} rows={16} placeholder="Paste the brief you wrote: where you are now, what you eventually want, any roadmap, your constraints. The more detail, the better the map." required minLength={30} style={{minHeight: 320}} /></label>
    {notice && <p className="form-note" role="alert">{notice}</p>}
    <div className="actions">
      <button className="btn" type="submit">Read my brief</button>
      <button className="btn btn--quiet" type="button" onClick={() => setText(EXAMPLE)}>Paste an example</button>
    </div>
  </form>;
}
