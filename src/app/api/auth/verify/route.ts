import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Token'ı header'dan veya cookie'den al
    const authHeader = request.headers.get('Authorization')
    let token: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      token = request.cookies.get('auth-token')?.value || null
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Token bulunamadı' },
        { status: 401 }
      )
    }

    // Token'ı doğrula
    const decoded = verify(token, process.env.JWT_SECRET || 'your-secret-key') as {
      userId: string
      username: string
      role: string
    }

    // Kullanıcının hala aktif olup olmadığını kontrol et
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('id, username, email, role, is_active, created_at, last_login')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single()

    if (error || !adminUser) {
      return NextResponse.json(
        { error: 'Geçersiz kullanıcı' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: adminUser
    })

  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json(
      { error: 'Geçersiz token' },
      { status: 401 }
    )
  }
}