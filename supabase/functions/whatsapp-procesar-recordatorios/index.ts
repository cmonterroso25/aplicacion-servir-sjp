import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GREEN_API_ID_INSTANCE = Deno.env.get('GREEN_API_ID_INSTANCE')!
const GREEN_API_TOKEN_INSTANCE = Deno.env.get('GREEN_API_TOKEN_INSTANCE')!
const GREEN_API_URL = Deno.env.get('GREEN_API_URL') ?? 'https://api.green-api.com'
const FUNCTION_SECRET = Deno.env.get('WHATSAPP_FUNCTION_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function enviarGreenApi(chatId: string, mensaje: string) {
  const url = `${GREEN_API_URL}/waInstance${GREEN_API_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN_INSTANCE}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: mensaje }),
  })
  if (!res.ok) {
    const texto = await res.text()
    throw new Error(`Green API error ${res.status}: ${texto}`)
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-notificacion-secret') !== FUNCTION_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const ahora = new Date().toISOString()

  const { data: pendientes, error } = await supabase
    .from('notificaciones_whatsapp')
    .select('id, chat_id, mensaje')
    .eq('enviado', false)
    .not('programado_para', 'is', null)
    .lte('programado_para', ahora)
    .limit(50)

  if (error) {
    console.error('Error leyendo recordatorios pendientes:', error)
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let enviados = 0
  for (const n of pendientes ?? []) {
    if (!n.chat_id) continue
    try {
      await enviarGreenApi(n.chat_id, n.mensaje)
      await supabase
        .from('notificaciones_whatsapp')
        .update({ enviado: true, enviado_en: new Date().toISOString() })
        .eq('id', n.id)
      enviados++
    } catch (err) {
      console.error(`Error enviando recordatorio ${n.id}:`, err)
    }
  }

  return new Response(JSON.stringify({ ok: true, procesados: pendientes?.length ?? 0, enviados }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
