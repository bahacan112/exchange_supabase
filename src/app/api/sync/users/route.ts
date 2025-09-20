import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { GraphService } from '@/lib/graph-client'
import { supabase } from '@/lib/supabase'

export const POST = requireAuth(async (request: NextRequest) => {
  try {
    console.log('Starting bulk user sync from Exchange...')

    // Exchange'den tüm kullanıcıları çek
    const graphUsers = await GraphService.getUsers()
    
    if (!graphUsers || graphUsers.length === 0) {
      return NextResponse.json(
        { error: 'Exchange\'den kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    console.log(`Found ${graphUsers.length} users in Exchange`)

    const syncResults = {
      total: graphUsers.length,
      created: 0,
      updated: 0,
      errors: 0,
      errorDetails: [] as string[]
    }

    // Her kullanıcı için senkronizasyon işlemi
    for (const graphUser of graphUsers) {
      try {
        // Mevcut kullanıcıyı kontrol et
        const { data: existingUser } = await supabase
          .from('exchange_users')
          .select('*')
          .eq('user_principal_name', graphUser.userPrincipalName)
          .single()

        const userData = {
          user_principal_name: graphUser.userPrincipalName,
          display_name: graphUser.displayName || '',
          email: graphUser.mail || graphUser.userPrincipalName,
          is_active: true,
          last_sync_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        if (existingUser) {
          // Kullanıcıyı güncelle
          const { error } = await supabase
            .from('exchange_users')
            .update(userData)
            .eq('id', existingUser.id)

          if (error) {
            throw error
          }

          syncResults.updated++
          console.log(`Updated user: ${graphUser.userPrincipalName}`)
        } else {
          // Yeni kullanıcı oluştur
          const { error } = await supabase
            .from('exchange_users')
            .insert({
              ...userData,
              created_at: new Date().toISOString()
            })

          if (error) {
            throw error
          }

          syncResults.created++
          console.log(`Created user: ${graphUser.userPrincipalName}`)
        }

      } catch (userError) {
        syncResults.errors++
        const errorMessage = userError instanceof Error ? userError.message : JSON.stringify(userError)
        const errorMsg = `Error syncing user ${graphUser.userPrincipalName}: ${errorMessage}`
        syncResults.errorDetails.push(errorMsg)
        console.error('User sync error details:', {
          user: graphUser.userPrincipalName,
          error: userError,
          errorMessage
        })
      }
    }

    console.log('Bulk user sync completed:', syncResults)

    return NextResponse.json({
      success: true,
      message: 'Kullanıcı senkronizasyonu tamamlandı',
      results: syncResults
    })

  } catch (error) {
    console.error('Bulk user sync error:', error)
    return NextResponse.json(
      { error: 'Kullanıcı senkronizasyonu başarısız: ' + (error as Error).message },
      { status: 500 }
    )
  }
})