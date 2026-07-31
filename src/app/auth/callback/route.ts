import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { appOrigin, safeRedirectPath } from "@/lib/url-security";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = appOrigin();
  const next = safeRedirectPath(url.searchParams.get("next"));
  if (!isSupabaseConfigured) return NextResponse.redirect(new URL("/auth?error=Supabase+is+not+configured", origin));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return NextResponse.redirect(new URL("/auth?error=The+sign-in+link+is+invalid+or+expired", origin));
  }
  return NextResponse.redirect(new URL("/auth?error=The+sign-in+link+is+invalid+or+expired", origin));
}
