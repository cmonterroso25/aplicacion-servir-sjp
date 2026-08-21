import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: NextRequest) {
  try {
    const { contentType } = await req.json()

    if (!contentType || !contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'contentType inválido' }, { status: 400 })
    }

    const ext = contentType === 'image/png' ? 'png' : 'jpg'
    const nombreArchivo = `entregas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: nombreArchivo,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 })
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${nombreArchivo}`

    return NextResponse.json({ uploadUrl, publicUrl })
  } catch (err: any) {
    console.error('Error generando URL firmada R2:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
