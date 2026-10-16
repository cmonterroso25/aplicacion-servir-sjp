import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    console.log('Service Role Key disponible:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Obtener todos los afiliados y sus roles únicos
    const { data: afiliados, error } = await supabase
      .from('afiliados')
      .select('rol_afiliado')

    console.log('Afiliados obtenidos:', afiliados?.length)
    console.log('Error:', error)

    // Obtener roles únicos
    const rolesUnicos = new Set<string>()
    const rolesConCuenta: Record<string, number> = {}

    afiliados?.forEach((a: any) => {
      if (a.rol_afiliado) {
        rolesUnicos.add(a.rol_afiliado)
        rolesConCuenta[a.rol_afiliado] = (rolesConCuenta[a.rol_afiliado] || 0) + 1
      }
    })

    return NextResponse.json({
      totalAfiliados: afiliados?.length || 0,
      rolesUnicos: Array.from(rolesUnicos).sort(),
      rolesConCuenta,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error al cargar roles' }, { status: 500 })
  }
}
