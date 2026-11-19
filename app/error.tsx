"use client";
export default function ErrorState({reset}: {reset: () => void}) {
  return <main className="page page--read"><div className="empty"><h1>Something went wrong</h1><p className="prose">Your data is safe. Try opening this page again.</p><button className="btn" onClick={reset}>Try again</button></div></main>;
}
