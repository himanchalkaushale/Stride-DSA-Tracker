"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithGoogle, signInWithPassword, type AuthState } from "./actions";
import { ArrowIcon } from "@/components/icons";

const initialState: AuthState = {};

export function LoginForm({ queryError }: { queryError?: string }) {
  const [state, action, pending] = useActionState(signInWithPassword, initialState);
  return (
    <div className="login-form">
      <form action={signInWithGoogle}>
        <button className="google-button" type="submit"><span>G</span>Continue with Google</button>
      </form>
      <div className="divider"><span />or continue with email<span /></div>
      <form action={action}>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" placeholder="Your password" autoComplete="current-password" required />
        {(state.error || queryError) && <p className="form-message error" role="alert">{state.error ?? queryError}</p>}
        <button className="button button-primary auth-submit" disabled={pending}>
          {pending ? "Signing in…" : <>Sign in <ArrowIcon /></>}
        </button>
      </form>
      <p className="auth-switch">New to Stride? <Link href="/auth/create-account">Create an account</Link></p>
      <p className="auth-terms">Secure authentication powered by Supabase.</p>
    </div>
  );
}
