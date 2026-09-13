import { createClient } from '@supabase/supabase-js'

// Solo usar desde código server-side (API routes, server actions).
// Nunca importar este archivo desde un componente 'use client'.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
