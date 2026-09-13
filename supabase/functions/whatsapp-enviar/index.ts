import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GREEN_API_ID_INSTANCE = Deno.env.get('GREEN_API_ID_INSTANCE')!
const GREEN_API_TOKEN_INSTANCE = Deno.env.get('GREEN_API_TOKEN_INSTANCE')!
const GREEN_API_URL = Deno.env.get('GREEN_API_URL') ?? 'https://api.green-api.com'
const FUNCTION_SECRET = Deno.env.get('WHATSAPP_FUNCTION_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface Payload {
  chatId: string
  mensaje: string
  registrar?: {
    reunion_id?: number | null
    tipo_notificacion: string
  }
}

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
  return res.json()
}

Deno.serve(async (req) => {
  if (req.headers.get('x-notificacion-secret') !== FUNCTION_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response('JSON inválido', { status: 400 })
  }
  if (!payload.chatId || !payload.mensaje) {
    return new Response('Faltan chatId o mensaje', { status: 400 })
  }
  try {
    await enviarGreenApi(payload.chatId, payload.mensaje)
  } catch (err) {
    console.error('Error enviando WhatsApp:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (payload.registrar) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const ahora = new Date().toISOString()
    const { error } = await supabase.from('notificaciones_whatsapp').insert({
      chat_id: payload.chatId,
      mensaje: payload.mensaje,
      tipo_notificacion: payload.registrar.tipo_notificacion,
      reunion_id: payload.registrar.reunion_id ?? null,
      enviado: true,
      enviado_en: ahora,
    })
    if (error) console.error('Error registrando auditoría:', error)
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
