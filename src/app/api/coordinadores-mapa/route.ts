import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // Obtener coordinadores por sector
    const { data: coordinadores } = await supabase
      .from('afiliados')
      .select('sector_id, rol_afiliado')
      .eq('rol_afiliado', 'Coordinador')

    // Obtener sectores con sus IDs y nombres
    const { data: sectores } = await supabase
      .from('sectores')
      .select('id, nombre')

    // Contar coordinadores por sector_id
    const coordinadoresPorSectorId: Record<number, number> = {}
    coordinadores?.forEach((c: any) => {
      if (c.sector_id) {
        coordinadoresPorSectorId[c.sector_id] = (coordinadoresPorSectorId[c.sector_id] || 0) + 1
      }
    })

    // Crear mapeo de sector_id a nombre
    const sectorMap = new Map(sectores?.map(s => [s.id, s.nombre]) || [])

    // Agregar conteo de coordinadores a sectores
    const resultado = sectores?.map(s => ({
      id: s.id,
      nombre: s.nombre,
      coordinadores: coordinadoresPorSectorId[s.id] || 0,
    })) || []

    // Función para normalizar nombres
    const normalizarNombre = (nombre: string) => {
      return nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
    }

    // También crear mapeo por nombre normalizado
    const coordinadoresPorNombre: Record<string, number> = {}
    resultado.forEach(item => {
      if (item.coordinadores > 0) {
        const nombreNormalizado = normalizarNombre(item.nombre)
        coordinadoresPorNombre[nombreNormalizado] = item.coordinadores
        // También guardar sin normalizar para coincidencias exactas
        coordinadoresPorNombre[item.nombre] = item.coordinadores
      }
    })

    // Separar coordinadores de "Casco Urbano 2 y 4" entre Zona 2 y Zona 4
    const cascoUrbano24Count = coordinadoresPorNombre['Casco Urbano 2 y 4'] || 0
    if (cascoUrbano24Count > 0) {
      const zona2Count = Math.ceil(cascoUrbano24Count / 2)
      const zona4Count = cascoUrbano24Count - zona2Count
      coordinadoresPorNombre['Zona 2'] = zona2Count
      coordinadoresPorNombre['Zona 4'] = zona4Count
    }

    // Separar coordinadores de "Casco Urbano 1 y 3" entre Zona 1 y Zona 3
    const cascoUrbano13Count = coordinadoresPorNombre['Casco Urbano 1 y 3'] || 0
    if (cascoUrbano13Count > 0) {
      const zona1Count = Math.ceil(cascoUrbano13Count / 2)
      const zona3Count = cascoUrbano13Count - zona1Count
      coordinadoresPorNombre['Zona 1'] = zona1Count
      coordinadoresPorNombre['Zona 3'] = zona3Count
    }

    console.log('Coordinadores mapeados:', Object.keys(coordinadoresPorNombre).length, 'nombres únicos')
    console.log('Primeros 5 nombres:', Object.keys(coordinadoresPorNombre).slice(0, 5))

    return NextResponse.json({
      porId: resultado,
      porNombre: coordinadoresPorNombre,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error al cargar coordinadores' }, { status: 500 })
  }
}
