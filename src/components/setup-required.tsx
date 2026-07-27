import Link from "next/link";
import { LogoIcon } from "./icons";

export function SetupRequired() {
  return (
    <main className="setup-required">
      <span className="mini-logo"><LogoIcon /></span>
      <span className="eyebrow">One setup step remaining</span>
      <h1>Connect your Supabase project.</h1>
      <p>The interface is ready. Add the project URL and anonymous key to <code>.env.local</code>, run the migration, then restart the development server.</p>
      <div className="code-block">
        <span>NEXT_PUBLIC_SUPABASE_URL=…</span>
        <span>NEXT_PUBLIC_SUPABASE_ANON_KEY=…</span>
      </div>
      <Link className="button button-quiet" href="/">Return home</Link>
    </main>
  );
}
