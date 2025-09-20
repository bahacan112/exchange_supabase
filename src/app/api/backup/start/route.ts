import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { BackupServiceInstance, BackupOptions } from '@/lib/backup-service'
import { supabase } from '@/lib/supabase'

export const POST = requireAuth(async (request: NextRequest, user: any) => {
  try {
    const {
      userId,
      startDate,
      endDate,
      includeFolders,
      excludeFolders,
      includeAttachments = true,
      maxEmailSize = 25
    } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'userId gerekli' },
        { status: 400 }
      )
    }

    // Kullanıcı bilgilerini çek
    const { data: exchangeUser, error: userError } = await supabase
      .from('exchange_users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !exchangeUser) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Aktif yedekleme işi var mı kontrol et
    const { data: activeJob } = await supabase
      .from('backup_jobs')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'running'])
      .single()

    if (activeJob) {
      return NextResponse.json(
        { error: 'Bu kullanıcı için zaten aktif bir yedekleme işi var' },
        { status: 409 }
      )
    }

    // Eğer startDate belirtilmemişse, akıllı başlangıç tarihi belirle
    let finalStartDate = startDate ? new Date(startDate) : undefined
    
    if (!finalStartDate) {
      // DB'de bu kullanıcının maillerini kontrol et
      const { data: lastEmail } = await supabase
        .from('emails')
        .select('received_date')
        .eq('user_id', userId)
        .order('received_date', { ascending: false })
        .limit(1)
        .single()

      if (lastEmail?.received_date) {
        // DB'de mail varsa, son mailin 1 dakika öncesinden başla (incremental backup)
        const lastEmailDate = new Date(lastEmail.received_date)
        finalStartDate = new Date(lastEmailDate.getTime() - 60 * 1000) // 1 dakika önce
      }
      // DB'de hiç mail yoksa finalStartDate undefined kalır, Exchange'den ilk mailden başlar
    }

    const options: BackupOptions = {
      userId,
      userPrincipalName: exchangeUser.user_principal_name,
      startDate: finalStartDate,
      endDate: endDate ? new Date(endDate) : undefined,
      includeFolders,
      excludeFolders,
      includeAttachments,
      maxEmailSize
    }

    // Yedekleme işini başlat
    const jobId = await BackupServiceInstance.startBackup(options)

    return NextResponse.json({
      success: true,
      message: 'Yedekleme işi başlatıldı',
      jobId,
      user: {
        id: exchangeUser.id,
        displayName: exchangeUser.display_name,
        email: exchangeUser.email
      },
      startDate: finalStartDate?.toISOString()
    })

  } catch (error) {
    console.error('Start backup error:', error)
    return NextResponse.json(
      { error: 'Yedekleme başlatılamadı: ' + (error as Error).message },
      { status: 500 }
    )
  }
})