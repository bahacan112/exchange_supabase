import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthUser } from '@/lib/auth'
import { listFiles } from '@/lib/idrive'

export const GET = requireAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const prefix = searchParams.get('prefix') || user.id

    // Kullanıcının dosyalarını listele
    const files = await listFiles(prefix)

    return NextResponse.json({
      success: true,
      data: {
        files: files || [],
        count: files?.length || 0
      }
    })

  } catch (error) {
    console.error('File list error:', error)
    return NextResponse.json(
      { success: false, error: 'Dosya listeleme hatası' },
      { status: 500 }
    )
  }
})