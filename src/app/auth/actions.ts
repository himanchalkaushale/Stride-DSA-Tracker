"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, supabaseUrl } from "@/lib/supabase/config";
import { appOrigin, safeSupabaseOAuthUrl } from "@/lib/url-security";

export type AuthState = { error?: string; success?: string };

function readEmail(formData: FormData) {
  return String(formData.get("email") ?? "").trim().toLowerCase();
}

export async function signInWithPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "Supabase is not configured yet. See .env.example." };
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length > 1024) return { error: "The email or password is incorrect." };
  if (!password) return { error: "Enter your password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "The email or password is incorrect." };
  redirect("/today");
}

export async function createAccount(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "Supabase is not configured yet. See .env.example." };
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 12 || password.length > 128) return { error: "Use 12 to 128 characters for your password." };
  if (password !== confirmation) return { error: "The passwords do not match." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: "We could not create the account. Check the details and try again." };
  if (!data.session) {
    return {
      error: "Email confirmation is still enabled in Supabase. Turn off Confirm email, then try again.",
    };
  }
  redirect("/onboarding");
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) redirect("/auth?error=Supabase+is+not+configured");
  const origin = appOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=/today` },
  });
  if (error) redirect("/auth?error=Google+sign-in+could+not+be+started");
  const authorizationUrl = safeSupabaseOAuthUrl(data.url, supabaseUrl ?? "");
  if (authorizationUrl) redirect(authorizationUrl);
  redirect("/auth?error=Google+sign-in+returned+an+invalid+redirect");
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
