import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET - Kullanıcının ilk mail tarihini getir
export const GET = requireAuth(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parametresi gerekli' },
        { status: 400 }
      )
    }

    // Kullanıcının en eski mailini bul
    const { data: firstEmail, error } = await supabase
      .from('emails')
      .select('received_date')
      .eq('exchange_user_id', userId)
      .order('received_date', { ascending: true })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    return NextResponse.json({
      success: true,
      firstEmailDate: firstEmail?.received_date || null
    })

  } catch (error) {
    console.error('Get first email date error:', error)
    return NextResponse.json(
      { error: 'İlk mail tarihi alınamadı: ' + (error as Error).message },
      { status: 500 }
    )
  }
})