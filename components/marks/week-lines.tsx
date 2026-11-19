type Day = { label: string; minutes?: number; rest?: boolean; today?: boolean; future?: boolean };

export function WeekLines({ days, plannedMinutes }: { days: Day[]; plannedMinutes?: number }) {
  return <div className="week-lines">{days.map((day) => {
    const stroke = Math.min(100, ((day.minutes ?? 0) / 90) * 100);
    const planned = day.today && plannedMinutes ? Math.min(100, (plannedMinutes / 90) * 100) : 0;
    return <button className={`week-line ${day.today ? "week-line--today" : ""}`} key={day.label} aria-label={`${day.label}, ${day.rest ? "rest" : day.minutes ? `${day.minutes} minutes` : day.future ? "upcoming" : "no entries"}`}>
      <span>{day.label}</span><span className="week-line__track">{planned > 0 && <i className="week-line__planned" style={{ width: `${planned}%` }} />}{stroke > 0 && <i className="week-line__stroke" style={{ width: `${stroke}%` }} />}</span><small>{day.rest ? "rest" : day.minutes ? `${day.minutes} min` : day.today ? "today" : ""}</small>
    </button>;
  })}</div>;
}
