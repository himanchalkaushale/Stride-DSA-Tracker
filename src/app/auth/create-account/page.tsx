import Link from "next/link";
import { LogoIcon } from "@/components/icons";
import { CreateAccountForm } from "./create-account-form";
import { ThemeMenu } from "@/components/theme-control";

export default function CreateAccountPage() {
  return (
    <main className="auth-page">
      <header className="auth-top"><Link href="/" className="brand auth-brand"><span><LogoIcon /></span>stride</Link><ThemeMenu /></header>
      <section className="auth-card">
        <div className="auth-heading">
          <span className="mini-logo"><LogoIcon /></span>
          <h1>Create your Stride account</h1>
          <p>Choose your email and password to start building your DSA practice workspace.</p>
        </div>
        <CreateAccountForm />
      </section>
      <p className="auth-footer">One secure account for all your practice progress.</p>
    </main>
  );
}
