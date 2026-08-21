'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  onCaptured: (publicUrl: string) => void
  onCancel: () => void
}

export default function WebcamCapture({ onCaptured, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [capturada, setCapturada] = useState<string | null>(null)
  const [blobCapturado, setBlobCapturado] = useState<Blob | null>(null)

  useEffect(() => {
    let activo = true
    const iniciar = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        if (!activo) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err: any) {
        setError('No se pudo acceder a la cámara: ' + (err?.message || 'permiso denegado'))
      }
    }
    iniciar()
    return () => {
      activo = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const tomarFoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setBlobCapturado(blob)
        setCapturada(canvas.toDataURL('image/jpeg', 0.85))
      },
      'image/jpeg',
      0.85
    )
  }

  const repetir = () => {
    setCapturada(null)
    setBlobCapturado(null)
  }

  const confirmar = async () => {
    if (!blobCapturado) return
    setSubiendo(true)
    setError('')
    try {
      const res = await fetch('/api/upload-r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar URL de subida')

      const putRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blobCapturado,
      })
      if (!putRes.ok) throw new Error('Error al subir la imagen a R2')

      onCaptured(data.publicUrl)
    } catch (err: any) {
      setError(err?.message || 'Error al subir la foto')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="space-y-2 p-3 rounded-lg border" style={{ borderColor: 'var(--color-borde)', background: '#f8fafc' }}>
      {error && <p className="text-xs" style={{ color: '#9b1c3a' }}>{error}</p>}
      {!capturada ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="rounded-lg w-full max-w-xs bg-black" />
          <div className="flex gap-2">
            <button type="button" onClick={tomarFoto} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: '#004466' }}>
              Capturar foto
            </button>
            <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg font-semibold border" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <img src={capturada} alt="Foto capturada" className="rounded-lg w-full max-w-xs" />
          <div className="flex gap-2">
            <button type="button" onClick={confirmar} disabled={subiendo} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: '#166534' }}>
              {subiendo ? 'Subiendo...' : 'Usar esta foto'}
            </button>
            <button type="button" onClick={repetir} disabled={subiendo} className="text-xs px-3 py-1.5 rounded-lg font-semibold border disabled:opacity-50" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
              Repetir
            </button>
            <button type="button" onClick={onCancel} disabled={subiendo} className="text-xs px-3 py-1.5 rounded-lg font-semibold border disabled:opacity-50" style={{ borderColor: 'var(--color-borde)', color: 'var(--texto-secundario)' }}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
