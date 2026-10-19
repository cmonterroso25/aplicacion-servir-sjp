import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-enviar`
const WHATSAPP_FUNCTION_SECRET = process.env.WHATSAPP_FUNCTION_SECRET!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Guatemala no usa horario de verano: offset fijo todo el año.
const OFFSET_GUATEMALA = '-06:00'

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

function fechaHoraGuatemala(fecha: string, hora: string): Date {
  // Interpreta fecha/hora como hora local de Guatemala, sin importar la zona
  // horaria del servidor donde corre esta función (Vercel usa UTC).
  return new Date(`${fecha}T${hora}:00${OFFSET_GUATEMALA}`)
}

function formatFechaHora(fechaHora: Date): string {
  return fechaHora.toLocaleString('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guatemala',
  })
}

function construirMensaje(
  body: Body,
  fechaTexto: string,
  opciones: { encabezado: string; etiquetaFecha: string }
): string {
  return [
    opciones.encabezado,
    `📌 ${body.titulo}`,
    body.encargadoNombre ? `👤 Encargado: ${body.encargadoNombre}` : null,
    body.lugar ? `📍 ${body.lugar}` : null,
    `${opciones.etiquetaFecha} ${fechaTexto}`,
    body.descripcion ? `📝 ${body.descripcion}` : null,
  ].filter(Boolean).join('\n')
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

  const fechaHoraReunion = fechaHoraGuatemala(body.fecha, body.horaInicio)
  const fechaTexto = formatFechaHora(fechaHoraReunion)

  const mensajeInmediato = construirMensaje(body, fechaTexto, {
    encabezado: body.tipo === 'nueva_cita' ? '📅 *Nueva reunión agendada*' : '🔄 *Reunión reprogramada*',
    etiquetaFecha: body.tipo === 'nueva_cita' ? '🕐' : '🕐 Nueva fecha:',
  })

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
        mensaje: mensajeInmediato,
        registrar: {
          reunion_id: body.reunionId,
          tipo_notificacion: body.tipo,
        },
      }),
    })
    if (!res.ok) {
      console.error('Error notificando WhatsApp:', await res.text())
    }
  } catch (err) {
    console.error('Error de red notificando WhatsApp:', err)
  }

  // Si se reprograma, cancelar los recordatorios pendientes (aún no enviados)
  // de la cita anterior antes de programar los nuevos.
  if (body.tipo === 'cita_reprogramada') {
    const { error: errorCancelar } = await admin
      .from('notificaciones_whatsapp')
      .delete()
      .eq('reunion_id', body.reunionId)
      .eq('enviado', false)
      .in('tipo_notificacion', ['recordatorio_24h', 'recordatorio_3h'])
    if (errorCancelar) console.error('Error cancelando recordatorios previos:', errorCancelar)
  }

  // Programar recordatorios 24h y 3h antes (solo si ese momento aún no pasó).
  const ahora = new Date()
  const definiciones = [
    { tipo: 'recordatorio_24h', horas: 24, encabezado: '⏰ *Recordatorio: reunión mañana*' },
    { tipo: 'recordatorio_3h', horas: 3, encabezado: '⏰ *Recordatorio: reunión en 3 horas*' },
  ]

  const filas = definiciones
    .map(({ tipo, horas, encabezado }) => {
      const programadoPara = new Date(fechaHoraReunion.getTime() - horas * 60 * 60 * 1000)
      if (programadoPara <= ahora) return null
      return {
        reunion_id: body.reunionId,
        chat_id: grupo.chat_id,
        mensaje: construirMensaje(body, fechaTexto, { encabezado, etiquetaFecha: '🕐' }),
        tipo_notificacion: tipo,
        enviado: false,
        programado_para: programadoPara.toISOString(),
      }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)

  if (filas.length > 0) {
    const { error: errorRecordatorios } = await admin.from('notificaciones_whatsapp').insert(filas)
    if (errorRecordatorios) console.error('Error programando recordatorios:', errorRecordatorios)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { reunionId } = await req.json()
  if (!reunionId) {
    return NextResponse.json({ ok: false, error: 'Falta reunionId' }, { status: 400 })
  }
  const admin = supabaseAdmin()
  const { error } = await admin
    .from('notificaciones_whatsapp')
    .delete()
    .eq('reunion_id', reunionId)
    .eq('enviado', false)
  if (error) {
    console.error('Error cancelando recordatorios:', error)
    return NextResponse.json({ ok: false })
  }
  return NextResponse.json({ ok: true })
}
