import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // Obtener el conteo total de afiliados
    const { count: totalCount } = await supabase
      .from('afiliados')
      .select('*', { count: 'exact', head: true })

    // Obtener todos los afiliados para contar por sector (con paginación)
    let allAfiliados: any[] = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const { data: pageData, error: pageError } = await supabase
        .from('afiliados')
        .select('sector_id')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (pageError || !pageData || pageData.length === 0) break
      allAfiliados = allAfiliados.concat(pageData)
      if (pageData.length < pageSize) break
      page++
    }

    const afiliados = allAfiliados

    // Obtener sectores con sus nombres
    const { data: sectores } = await supabase
      .from('sectores')
      .select('id, nombre')

    // Contar afiliados por sector_id
    const afiliadosPorSectorId: Record<number, number> = {}
    afiliados?.forEach((a: any) => {
      if (a.sector_id) {
        afiliadosPorSectorId[a.sector_id] = (afiliadosPorSectorId[a.sector_id] || 0) + 1
      }
    })

    // Crear mapeo de sector_id a nombre
    const sectorMap = new Map(sectores?.map(s => [s.id, s.nombre]) || [])

    // Función para normalizar nombres
    const normalizarNombre = (nombre: string) => {
      return nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
    }

    // Crear mapeo por nombre (normalizado y sin normalizar)
    const afiliadosPorNombre: Record<string, number> = {}
    sectores?.forEach((s: any) => {
      const count = afiliadosPorSectorId[s.id] || 0
      const nombreNormalizado = normalizarNombre(s.nombre)
      afiliadosPorNombre[nombreNormalizado] = count
      afiliadosPorNombre[s.nombre] = count
    })

    // Separar coordinadores de "Casco Urbano 2 y 4" entre Zona 2 y Zona 4
    const cascoUrbano24Count = afiliadosPorNombre['Casco Urbano 2 y 4'] || 0
    if (cascoUrbano24Count > 0) {
      const zona2Count = Math.ceil(cascoUrbano24Count / 2)
      const zona4Count = cascoUrbano24Count - zona2Count
      afiliadosPorNombre['Zona 2'] = zona2Count
      afiliadosPorNombre['Zona 4'] = zona4Count
    }

    // Separar coordinadores de "Casco Urbano 1 y 3" entre Zona 1 y Zona 3
    const cascoUrbano13Count = afiliadosPorNombre['Casco Urbano 1 y 3'] || 0
    if (cascoUrbano13Count > 0) {
      const zona1Count = Math.ceil(cascoUrbano13Count / 2)
      const zona3Count = cascoUrbano13Count - zona1Count
      afiliadosPorNombre['Zona 1'] = zona1Count
      afiliadosPorNombre['Zona 3'] = zona3Count
    }

    return NextResponse.json({
      afiliadosPorNombre,
      totalAfiliados: totalCount || afiliados.length || 0,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error al cargar afiliados' }, { status: 500 })
  }
}
