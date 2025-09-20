import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET - Belirli bir kullanıcıyı getir
export const GET = requireAuth(async (
  request: NextRequest,
  user: AuthUser,
  { params }: { params: { id: string } }
) => {
  try {
    const { data: user, error } = await supabase
      .from('exchange_users')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      throw error
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user
    })

  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Kullanıcı yüklenemedi: ' + (error as Error).message },
      { status: 500 }
    )
  }
})

// PUT - Kullanıcıyı güncelle
export const PUT = requireAuth(async (
  request: NextRequest,
  user: AuthUser,
  { params }: { params: { id: string } }
) => {
  try {
    const updates = await request.json()

    const { data: user, error } = await supabase
      .from('exchange_users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Kullanıcı başarıyla güncellendi',
      user
    })

  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Kullanıcı güncellenemedi: ' + (error as Error).message },
      { status: 500 }
    )
  }
})

// DELETE - Kullanıcıyı sil
export const DELETE = requireAuth(async (
  request: NextRequest,
  user: AuthUser,
  { params }: { params: { id: string } }
) => {
  try {
    const { error } = await supabase
      .from('exchange_users')
      .delete()
      .eq('id', params.id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Kullanıcı başarıyla silindi'
    })

  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Kullanıcı silinemedi: ' + (error as Error).message },
      { status: 500 }
    )
  }
})