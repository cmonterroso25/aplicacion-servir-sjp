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
  origen?: 'calendario' | 'linea_tiempo'
  linea_tiempo_id?: string | null
  perfiles?: { nombre_completo: string | null; email: string } | null
  sectores?: { nombre: string } | null
}
export type LineaTiempoEvento = {
  id: string
  titulo: string
  descripcion: string | null
  lugar: string | null
  encargado_nombre: string | null
  fecha: string
  hora_inicio: string
  hora_fin: string | null
  creado_por: string
  created_at: string | null
}
export type Secretaria = {
  id: string
  nombre: string
  grupo: 'sectorial' | 'territorial' | 'transversal' | 'estrategica' | 'administrativa'
  reporta_directo: boolean
  transversal: boolean
  encargado_nombre: string | null
  mision: string | null
  vision: string | null
  funciones_permanentes: string | null
  funciones_proselitismo: string | null
  funciones_campana: string | null
  metas_corto: string | null
  metas_mediano: string | null
  metas_largo: string | null
  coordinacion: string | null
  orden: number
  created_at: string | null
}
export type SecretariaIndicador = {
  id: string
  secretaria_id: string
  indicador: string
  meta: string | null
  periodo: string | null
  orden: number
}
export type Configuracion = {
  clave: string
  valor: string | null
  updated_at: string | null
}
export type AfiliadoLegal = {
  id: number
  dpi: string
  boleta: string | null
  cedula: string | null
  nombre_completo: string
  fecha_afiliacion_legal: string | null
  primer_apellido: string | null
  segundo_apellido: string | null
  primer_nombre: string | null
  segundo_nombre: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  sector_id: number | null
  encargado_id: string | null
  tipo_ubicacion: string | null
  nombre_ubicacion: string | null
  vota_en_pinula: boolean | null
  genero: string | null
  edad: string | null
  afiliado_por: string | null
  rol_afiliado: string | null
  direccion: string | null
  afiliado_id: number | null
  vinculado: boolean
  created_at: string | null
}
export type AfiliadoLegalConRelacion = AfiliadoLegal & {
  afiliados: {
    id: number
    primer_apellido: string
    segundo_apellido: string | null
    primer_nombre: string
    segundo_nombre: string | null
    dpi: string | null
  } | null
}

// ============================================
// MÓDULO DE INVENTARIO
// ============================================
export type InventarioProducto = {
  id: number
  nombre: string
  categoria: string | null
  unidad_medida: string | null
  costo_unitario: number
  activo: boolean
  created_at: string | null
}
export type InventarioIngreso = {
  id: number
  producto_id: number
  cantidad: number
  costo_unitario: number
  proveedor: string | null
  notas: string | null
  fecha: string
  creado_por: string | null
  created_at: string | null
  inventario_productos?: { nombre: string; unidad_medida: string | null } | null
}
export type InventarioEntrega = {
  id: number
  producto_id: number
  perfil_id: string
  cantidad: number
  costo_unitario: number
  cantidad_devuelta: number
  reunion_id: number | null
  fecha: string
  entregado_por: string | null
  notas: string | null
  foto_url: string | null
  lote_id: string | null
  created_at: string | null
  inventario_productos?: { nombre: string; unidad_medida: string | null } | null
  perfiles?: { nombre_completo: string | null; email: string } | null
  reuniones?: { titulo: string } | null
}
export type InventarioStockActual = {
  producto_id: number
  nombre: string
  categoria: string | null
  unidad_medida: string | null
  costo_unitario: number
  activo: boolean
  total_ingresado: number
  total_entregado_neto: number
  stock_actual: number
}
export type InventarioCostoPorColaborador = {
  perfil_id: string
  nombre_completo: string | null
  costo_neto_entregado: number
  costo_bruto_entregado: number
  costo_devuelto: number
  num_entregas: number
}
