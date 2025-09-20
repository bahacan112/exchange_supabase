import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'user'
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Token'ı header'dan veya cookie'den al
    const authHeader = request.headers.get('Authorization')
    let token: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      // Cookie'den token'ı dene
      token = request.cookies.get('auth-token')?.value || null
    }

    if (!token) {
      return null
    }

    const supabase = createServerClient()
    
    // Token'ı doğrula
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return null
    }

    // Profile bilgilerini al
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    return {
      id: profile.id,
      username: profile.username,
      role: profile.role
    }

  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export function createAuthMiddleware(requiredRole?: 'admin' | 'user') {
  return async (request: NextRequest) => {
    const user = await getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim' },
        { status: 401 }
      )
    }

    if (requiredRole && user.role !== requiredRole) {
      return NextResponse.json(
        { error: 'Yetersiz yetki' },
        { status: 403 }
      )
    }

    // Kullanıcı bilgilerini request'e ekle
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', user.id)
    requestHeaders.set('x-user-username', user.username)
    requestHeaders.set('x-user-role', user.role)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
}

// Geriye dönük uyumluluk için requireAuth fonksiyonu
export function requireAuth(
  handler: (request: NextRequest, user: AuthUser, params?: any) => Promise<NextResponse>, 
  requiredRole?: 'admin' | 'user'
) {
  return async (request: NextRequest, context?: { params: any }) => {
    const user = await getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim' },
        { status: 401 }
      )
    }

    if (requiredRole && user.role !== requiredRole) {
      return NextResponse.json(
        { error: 'Yetersiz yetki' },
        { status: 403 }
      )
    }

    // Kullanıcı bilgilerini request headers'a ekle
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', user.id)
    requestHeaders.set('x-user-username', user.username)
    requestHeaders.set('x-user-role', user.role)

    // Yeni request objesi oluştur
    const modifiedRequest = new NextRequest(request, {
      headers: requestHeaders
    })

    return handler(modifiedRequest, user, context)
  }
}