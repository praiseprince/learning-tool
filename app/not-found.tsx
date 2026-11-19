import Link from "next/link";
export default function Missing() { return <main className="page page--read"><div className="empty"><h1>Not found</h1><p className="prose">That page does not exist, or it was part of an older version of the app.</p><Link className="btn" href="/">Go to Today</Link></div></main>; }
