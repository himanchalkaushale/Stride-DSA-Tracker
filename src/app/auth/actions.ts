"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AuthState = { error?: string; success?: string };

export async function signInWithEmail(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: "Supabase is not configured yet. See .env.example." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/today` },
  });
  if (error) return { error: error.message };
  return { success: "Check your inbox. We sent you a secure sign-in link." };
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) redirect("/auth?error=Supabase+is+not+configured");
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=/today` },
  });
  if (error) redirect(`/auth?error=${encodeURIComponent(error.message)}`);
  if (data.url) redirect(data.url);
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
