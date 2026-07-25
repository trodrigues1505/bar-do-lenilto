import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

// Singleton: reaproveita a mesma instância em todo o app, em vez de criar
// uma nova toda vez que um componente chama createClient(). Ter várias
// instâncias ao mesmo tempo pode atrapalhar a troca do código do login (PKCE).
export function createClient() {
  if (!client) {
    client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    )
  }
  return client
}
