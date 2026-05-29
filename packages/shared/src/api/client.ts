import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

interface SupabaseAuthStorage {
  getItem: (key: string) => string | Promise<string | null> | null;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

interface SupabaseConfig {
  url: string;
  anonKey: string;
  options?: {
    auth?: {
      persistSession?: boolean;
      autoRefreshToken?: boolean;
      detectSessionInUrl?: boolean;
      storage?: SupabaseAuthStorage;
    };
  };
}

let supabaseClient: TypedSupabaseClient | null = null;

export function initSupabase(config: SupabaseConfig): TypedSupabaseClient {
  const auth = config.options?.auth;

  supabaseClient = createClient<Database>(config.url, config.anonKey, {
    auth: {
      persistSession: auth?.persistSession ?? true,
      autoRefreshToken: auth?.autoRefreshToken ?? true,
      detectSessionInUrl: auth?.detectSessionInUrl ?? true,
      storage: auth?.storage,
    },
  });
  return supabaseClient;
}

export function getSupabase(): TypedSupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      "Supabase client not initialized. Call initSupabase() first.",
    );
  }
  return supabaseClient;
}
