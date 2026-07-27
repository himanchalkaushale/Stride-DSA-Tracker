"use client";

import { useActionState } from "react";
import { signInWithEmail, signInWithGoogle, type AuthState } from "./actions";
import { ArrowIcon } from "@/components/icons";

const initialState: AuthState = {};

export function LoginForm({ queryError }: { queryError?: string }) {
  const [state, action, pending] = useActionState(signInWithEmail, initialState);
  return (
    <div className="login-form">
      <form action={signInWithGoogle}>
        <button className="google-button" type="submit"><span>G</span>Continue with Google</button>
      </form>
      <div className="divider"><span />or continue with email<span /></div>
      <form action={action}>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        {(state.error || queryError) && <p className="form-message error" role="alert">{state.error ?? queryError}</p>}
        {state.success && <p className="form-message success" role="status">{state.success}</p>}
        <button className="button button-primary auth-submit" disabled={pending}>
          {pending ? "Sending secure link…" : <>Continue with email <ArrowIcon /></>}
        </button>
      </form>
      <p className="auth-terms">By continuing, you agree to keep showing up for yourself.</p>
    </div>
  );
}
