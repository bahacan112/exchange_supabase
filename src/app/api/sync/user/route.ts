import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { GraphService } from '@/lib/graph-client'
import { supabase } from '@/lib/supabase'

export const POST = requireAuth(async (request: NextRequest) => {
  try {
    const { userPrincipalName } = await request.json()

    if (!userPrincipalName) {
      return NextResponse.json(
        { error: 'userPrincipalName gerekli' },
        { status: 400 }
      )
    }

    console.log(`Syncing user: ${userPrincipalName}`)

    // Exchange'den kullanıcı bilgilerini çek
    const graphUsers = await GraphService.getUsers()
    const graphUser = graphUsers.find((u: any) => u.userPrincipalName === userPrincipalName)

    if (!graphUser) {
      return NextResponse.json(
        { error: 'Kullanıcı Exchange\'de bulunamadı' },
        { status: 404 }
      )
    }

    // Mevcut kullanıcıyı kontrol et
    const { data: existingUser } = await supabase
      .from('exchange_users')
      .select('*')
      .eq('user_principal_name', userPrincipalName)
      .single()

    const userData = {
      user_principal_name: graphUser.userPrincipalName,
      display_name: graphUser.displayName || '',
      email: graphUser.mail || graphUser.userPrincipalName,
      is_active: true,
      last_sync_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    let user
    if (existingUser) {
      // Kullanıcıyı güncelle
      const { data, error } = await supabase
        .from('exchange_users')
        .update(userData)
        .eq('id', existingUser.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      user = data
      console.log(`Updated user: ${userPrincipalName}`)
    } else {
      // Yeni kullanıcı oluştur
      const { data, error } = await supabase
        .from('exchange_users')
        .insert({
          ...userData,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      user = data
      console.log(`Created user: ${userPrincipalName}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Kullanıcı başarıyla senkronize edildi',
      user
    })

  } catch (error) {
    console.error('User sync error:', error)
    return NextResponse.json(
      { error: 'Kullanıcı senkronizasyonu başarısız: ' + (error as Error).message },
      { status: 500 }
    )
  }
})