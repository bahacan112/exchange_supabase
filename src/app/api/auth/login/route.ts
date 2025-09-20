import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email ve şifre gerekli' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Giriş yapmayı dene
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (authError) {
      console.error('[Login] First signIn error:', authError)
    }

    // Eğer admin için kullanıcı yoksa otomatik oluştur veya parolayı ayarla (sadece bu e-posta için)
    if ((authError || !authData?.user) && email === 'admin@exchange.local') {
      try {
        // Önce mevcut kullanıcı var mı kontrol et
        const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existing = list.data?.users?.find((u: any) => u.email?.toLowerCase() === email)
        if (existing) {
          // Parolayı ve metadata'yı güncelle
          await supabase.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
            user_metadata: { username: 'admin' }
          })
        } else {
          // Yeni kullanıcı oluştur
          await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { username: 'admin' }
          })
        }
      } catch (e) {
        console.error('[Login][Admin ensure user] error:', e)
      }
      // Tekrar giriş dene
      const retry = await supabase.auth.signInWithPassword({ email, password })
      if (retry.error) {
        console.error('[Login] Retry signIn error:', retry.error)
      }
      authData = retry.data
      authError = retry.error as any
    }

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: 'Geçersiz email veya şifre' },
        { status: 401 }
      )
    }

    const user = authData.user

    // Profil bilgilerini al, yoksa oluştur/güncelle
    let { data: profile } = await supabase
      .from('profiles')
      .select('id, username, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      const defaultRole = email === 'admin@exchange.local' ? 'admin' : 'user'
      const defaultUsername = (user.user_metadata as any)?.username || email.split('@')[0]
      const upsertRes = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: defaultUsername,
          role: defaultRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select('id, username, role')
        .single()
      profile = upsertRes.data as any
    }

    // JWT token'ı al (doğrudan signIn yanıtından)
    const token = authData.session?.access_token

    if (!token) {
      return NextResponse.json(
        { error: 'Token oluşturulamadı' },
        { status: 500 }
      )
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: profile?.id || authData.user.id,
        username: profile?.username || email,
        role: profile?.role || 'user'
      },
      token
    })

    // HTTP-only cookie olarak token'ı set et
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 saat
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}