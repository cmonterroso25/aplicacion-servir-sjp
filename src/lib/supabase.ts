import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Empadronado = {
  id: number
  dpi: string
  primer_nombre: string
  segundo_nombre: string | null
  primer_apellido: string
  segundo_apellido: string | null
  genero: string
  edad: number
  departamento: string
  municipio: string
  direccion: string
}
export type Perfil = {
  id: string
  email: string
  nombre_completo: string | null
  rol: string
  created_at: string
}

export type Sector = {
  id: number
  nombre: string
  descripcion: string | null
  encargado_nombre: string | null
}

export type Afiliado = {
  id: number
  dpi: string
  primer_nombre: string
  segundo_nombre: string | null
  primer_apellido: string
  segundo_apellido: string | null
  genero: string
  edad: number
  departamento: string
  municipio: string
  direccion: string
  sector_id: number | null
  rol: string
  created_at: string
}
