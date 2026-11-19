import {newNote} from "./actions";

export default function NotesHome() {
  return <div className="notes-empty">
    <h2>Pick a note, or start a new one</h2>
    <p className="prose">Notes are where you think in your own words. Link a skill with <code>[[double brackets]]</code>, write maths with <code>$…$</code>, and the map picks up what you wrote.</p>
    <form action={newNote}><input type="hidden" name="title" value="Untitled note" /><button className="btn">New note</button></form>
  </div>;
}
