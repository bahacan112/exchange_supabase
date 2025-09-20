import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthUser } from '@/lib/auth'
import { deleteFile } from '@/lib/idrive'

export const DELETE = requireAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'key parametresi gerekli' },
        { status: 400 }
      )
    }

    // Güvenlik kontrolü: kullanıcı sadece kendi dosyalarını silebilir
    if (!key.startsWith(user.id + '/')) {
      return NextResponse.json(
        { success: false, error: 'Bu dosyayı silme yetkiniz yok' },
        { status: 403 }
      )
    }

    // Dosyayı sil
    const result = await deleteFile(key)

    return NextResponse.json({
      success: true,
      data: {
        key,
        deleteResult: result
      }
    })

  } catch (error) {
    console.error('File delete error:', error)
    return NextResponse.json(
      { success: false, error: 'Dosya silme hatası' },
      { status: 500 }
    )
  }
})