"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { requireSupabaseConfig } from "./config";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseConfig();
  client ??= createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}
