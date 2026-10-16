import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // Obtener todos los afiliados con rol_afiliado = 'Coordinador'
    const { data: coordinadores } = await supabase
      .from('afiliados')
      .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sector_id, rol_afiliado')
      .eq('rol_afiliado', 'Coordinador')

    // Obtener mapeo de sector_id a nombre de sector
    const { data: sectores } = await supabase
      .from('sectores')
      .select('id, nombre')

    console.log('Sectores en BD:', sectores?.length, sectores?.map((s: any) => `${s.id}:${s.nombre}`))

    const sectorMap = new Map(sectores?.map(s => [s.id, s.nombre]) || [])

    // Ver qué sector_ids hay en coordinadores
    const sectorIdsEnCoordinadores = new Set(coordinadores?.map((c: any) => c.sector_id).filter(Boolean) || [])
    console.log('Sector IDs en coordinadores:', Array.from(sectorIdsEnCoordinadores))

    // Agrupar coordinadores por sector
    const coordinadoresPorSector: Record<string, any[]> = {}

    coordinadores?.forEach((coord: any) => {
      const sectorNombre = coord.sector_id ? sectorMap.get(coord.sector_id) : 'Sin sector asignado'
      const nombreCompleto = [coord.primer_nombre, coord.segundo_nombre, coord.primer_apellido, coord.segundo_apellido]
        .filter(Boolean)
        .join(' ')

      if (!coordinadoresPorSector[sectorNombre]) {
        coordinadoresPorSector[sectorNombre] = []
      }

      coordinadoresPorSector[sectorNombre].push({
        id: coord.id,
        nombre: nombreCompleto,
        sector_id: coord.sector_id,
      })
    })

    // Convertir a array y ordenar
    const resultado = Object.entries(coordinadoresPorSector)
      .map(([sector, coords]) => ({
        sector,
        cantidad: coords.length,
        coordinadores: coords.sort((a, b) => a.nombre.localeCompare(b.nombre)),
      }))
      .sort((a, b) => {
        if (a.sector === 'Sin sector asignado') return 1
        if (b.sector === 'Sin sector asignado') return -1
        return a.sector.localeCompare(b.sector)
      })

    return NextResponse.json({
      totalCoordinadores: coordinadores?.length || 0,
      coordinadoresPorSector: resultado,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error al cargar coordinadores' }, { status: 500 })
  }
}
