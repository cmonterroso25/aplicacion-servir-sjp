import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Supabase ya verificó el token y redirige aquí.
  // Los tokens llegan en el hash (#) que solo ve el navegador,
  // así que redirigimos a una página cliente que los procesa.
  const origin = new URL(request.url).origin
  return NextResponse.redirect(`${origin}/auth/actualizar-contrasena`)
}