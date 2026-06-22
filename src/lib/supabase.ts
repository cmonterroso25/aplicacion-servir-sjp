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
  primer_apellido: string
  segundo_apellido: string | null
  primer_nombre: string
  segundo_nombre: string | null
  dpi: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  sector_id: number | null
  encargado_id: string | null
  tipo_ubicacion: string | null
  nombre_ubicacion: string | null
  vota_en_pinula: boolean | null
  created_at: string | null
  genero: string | null
  edad: string | null
  afiliado_por: string | null
  rol_afiliado: string | null
}

export type AfiliadoConRelaciones = Afiliado & {
  sectores: { nombre: string; encargado_nombre: string | null } | null
  perfiles: { nombre_completo: string | null; email: string } | null
}

export type Reunion = {
  id: number
  titulo: string
  descripcion: string | null
  fecha: string
  hora_inicio: string
  hora_fin: string | null
  lugar: string | null
  creado_por: string
  sector_id: number | null
  tipo: 'general' | 'sector' | 'templarios'
  created_at: string | null
  perfiles?: { nombre_completo: string | null; email: string } | null
  sectores?: { nombre: string } | null
}
