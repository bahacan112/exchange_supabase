import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthUser } from '@/lib/auth'
import { uploadFile } from '@/lib/idrive'

export const POST = requireAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Dosya bulunamadı' },
        { status: 400 }
      )
    }

    // Dosya adını oluştur (user_id/timestamp_filename)
    const timestamp = Date.now()
    const key = `${user.id}/${timestamp}_${file.name}`
    
    // Dosyayı buffer'a çevir
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // IDrive e2'ye yükle
    const result = await uploadFile(key, buffer, file.type)

    return NextResponse.json({
      success: true,
      data: {
        key,
        size: file.size,
        type: file.type,
        uploadResult: result
      }
    })

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Dosya yükleme hatası' },
      { status: 500 }
    )
  }
})