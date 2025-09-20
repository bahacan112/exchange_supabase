import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthUser } from '@/lib/auth'
import { getDownloadUrl } from '@/lib/idrive'

export const GET = requireAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600')

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'key parametresi gerekli' },
        { status: 400 }
      )
    }

    // Güvenlik kontrolü: kullanıcı sadece kendi dosyalarına erişebilir
    if (!key.startsWith(user.id + '/')) {
      return NextResponse.json(
        { success: false, error: 'Bu dosyaya erişim yetkiniz yok' },
        { status: 403 }
      )
    }

    // İmzalı URL oluştur
    const url = await getDownloadUrl(key, expiresIn)

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: url,
        expiresIn,
        key
      }
    })

  } catch (error) {
    console.error('Download URL error:', error)
    return NextResponse.json(
      { success: false, error: 'İndirme URL\'si oluşturma hatası' },
      { status: 500 }
    )
  }
})