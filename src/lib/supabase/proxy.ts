import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { supabaseAnonKey, supabaseUrl } from "./config";

function contentSecurityPolicy(nonce: string) {
  const connectSources = ["'self'"];
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol === "https:" || url.protocol === "http:") {
        connectSources.push(url.origin, `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`);
      }
    } catch {
      // Invalid Supabase configuration is handled by requireSupabaseConfig.
    }
  }
  if (process.env.NODE_ENV !== "production") connectSources.push("ws:", "wss:");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function secureResponse(response: NextResponse, request: NextRequest, policy: string) {
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  if (/^\/(?:auth|onboarding|today|todos|plans|problems|analytics|settings)(?:\/|$)/.test(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const nextResponse = () => NextResponse.next({ request: { headers: requestHeaders } });

  if (!supabaseUrl || !supabaseAnonKey) return secureResponse(nextResponse(), request, policy);

  let response = nextResponse();
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = nextResponse();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return secureResponse(response, request, policy);
}
