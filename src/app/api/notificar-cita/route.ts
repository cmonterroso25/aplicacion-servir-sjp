import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-enviar`
const WHATSAPP_FUNCTION_SECRET = process.env.WHATSAPP_FUNCTION_SECRET!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface Body {
  tipo: 'nueva_cita' | 'cita_reprogramada'
  reunionId: number
  titulo: string
  encargadoNombre: string | null
  lugar: string | null
  fecha: string
  horaInicio: string
  descripcion: string | null
}

function formatFechaHora(fecha: string, hora: string): string {
  const fechaHora = new Date(`${fecha}T${hora}`)
  return fechaHora.toLocaleString('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guatemala',
  })
}

export async function POST(req: NextRequest) {
  const body: Body = await req.json()
  const admin = supabaseAdmin()

  const { data: grupo, error: errorGrupo } = await admin
    .from('whatsapp_grupos')
    .select('chat_id')
    .eq('grupo', 'citas')
    .maybeSingle()

  if (errorGrupo || !grupo?.chat_id) {
    console.error('No se pudo obtener chat_id del grupo "citas":', errorGrupo)
    return NextResponse.json({ ok: false, error: 'Grupo de WhatsApp de citas no configurado.' })
  }

  const fechaTexto = formatFechaHora(body.fecha, body.horaInicio)
  const mensaje = [
    body.tipo === 'nueva_cita' ? '📅 *Nueva reunión agendada*' : '🔄 *Reunión reprogramada*',
    `📌 ${body.titulo}`,
    body.encargadoNombre ? `👤 Encargado: ${body.encargadoNombre}` : null,
    body.lugar ? `📍 ${body.lugar}` : null,
    body.tipo === 'nueva_cita' ? `🕐 ${fechaTexto}` : `🕐 Nueva fecha: ${fechaTexto}`,
    body.descripcion ? `📝 ${body.descripcion}` : null,
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-notificacion-secret': WHATSAPP_FUNCTION_SECRET,
      },
      body: JSON.stringify({
        chatId: grupo.chat_id,
        mensaje,
        registrar: {
          reunion_id: body.reunionId,
          tipo_notificacion: body.tipo,
        },
      }),
    })
    if (!res.ok) {
      console.error('Error notificando WhatsApp:', await res.text())
      return NextResponse.json({ ok: false })
    }
  } catch (err) {
    console.error('Error de red notificando WhatsApp:', err)
    return NextResponse.json({ ok: false })
  }

  return NextResponse.json({ ok: true })
}
