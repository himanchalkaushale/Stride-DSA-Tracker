import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/today";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (!isSupabaseConfigured) return NextResponse.redirect(new URL("/auth?error=Supabase+is+not+configured", url.origin));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/auth?error=The+sign-in+link+is+invalid+or+expired", url.origin));
}
