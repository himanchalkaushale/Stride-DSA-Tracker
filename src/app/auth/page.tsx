import Link from "next/link";
import { LogoIcon } from "@/components/icons";
import { LoginForm } from "./login-form";
import { ThemeMenu } from "@/components/theme-control";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <header className="auth-top"><Link href="/" className="brand auth-brand"><span><LogoIcon /></span>stride</Link><ThemeMenu /></header>
      <section className="auth-card">
        <div className="auth-heading">
          <span className="mini-logo"><LogoIcon /></span>
          <h1>Welcome to Stride</h1>
          <p>Sign in to continue your DSA journey.</p>
        </div>
        <LoginForm queryError={error} />
      </section>
      <p className="auth-footer">Practice deliberately. Progress consistently.</p>
    </main>
  );
}
