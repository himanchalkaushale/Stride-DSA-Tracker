"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowIcon } from "@/components/icons";
import { createAccount, type AuthState } from "../actions";

const initialState: AuthState = {};

export function CreateAccountForm() {
  const [state, action, pending] = useActionState(createAccount, initialState);

  return (
    <div className="login-form">
      <form action={action}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <label htmlFor="password">Create password</label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />
        <label htmlFor="confirmation">Confirm password</label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          minLength={8}
          placeholder="Enter it again"
          autoComplete="new-password"
          required
        />
        {state.error && <p className="form-message error" role="alert">{state.error}</p>}
        <button className="button button-primary auth-submit" disabled={pending}>
          {pending ? "Creating account…" : <>Create account <ArrowIcon /></>}
        </button>
      </form>
      <p className="auth-switch">Already have a password? <Link href="/auth">Sign in</Link></p>
    </div>
  );
}
