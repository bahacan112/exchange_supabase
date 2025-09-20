import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET - Tüm Exchange kullanıcılarını listele
export const GET = requireAuth(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const search = url.searchParams.get('search') || ''
    const isActive = url.searchParams.get('active')

    let query = supabase
      .from('exchange_users')
      .select('*', { count: 'exact' })

    // Arama filtresi
    if (search) {
      query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%,user_principal_name.ilike.%${search}%`)
    }

    // Aktiflik filtresi
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    // Sayfalama
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: users, error, count } = await query
      .order('display_name', { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Kullanıcılar yüklenemedi: ' + (error as Error).message },
      { status: 500 }
    )
  }
})

// POST - Yeni Exchange kullanıcısı oluştur
export const POST = requireAuth(async (request: NextRequest) => {
  try {
    const userData = await request.json()

    const { data: user, error } = await supabase
      .from('exchange_users')
      .insert({
        ...userData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Kullanıcı başarıyla oluşturuldu',
      user
    })

  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Kullanıcı oluşturulamadı: ' + (error as Error).message },
      { status: 500 }
    )
  }
})