import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthUser } from '@/lib/auth'
import { SchedulerServiceInstance, ScheduledBackupConfig } from '@/lib/scheduler-service'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export const GET = requireAuth(async (
  request: NextRequest,
  user: AuthUser
) => {
  try {
    // Zamanlanmış yedekleme yapılandırmalarını çek
    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'scheduled_backups')
      .single()

    let configs: ScheduledBackupConfig[] = []
    if (settings?.value) {
      configs = JSON.parse(settings.value)
    }

    // Sadece kullanıcının kendi yapılandırmalarını döndür (admin değilse)
    if (user.role !== 'admin') {
      configs = configs.filter(config => config.userId === user.id)
    }

    return NextResponse.json({
      success: true,
      data: configs
    })

  } catch (error) {
    console.error('Failed to get scheduled backup configs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const POST = requireAuth(async (
  request: NextRequest,
  user: AuthUser
) => {
  try {
    const body = await request.json()
    const {
      userPrincipalName,
      cronExpression,
      backupType = 'incremental',
      retentionDays = 30,
      includeAttachments = true,
      maxEmailSize = 25 * 1024 * 1024, // 25MB
      zipBackups = true
    } = body

    // Gerekli alanları kontrol et
    if (!userPrincipalName || !cronExpression) {
      return NextResponse.json(
        { error: 'User principal name and cron expression are required' },
        { status: 400 }
      )
    }

    // Cron ifadesini doğrula
    try {
      const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
      if (!cronRegex.test(cronExpression)) {
        return NextResponse.json(
          { error: 'Invalid cron expression' },
          { status: 400 }
        )
      }
    } catch (cronError) {
      return NextResponse.json(
        { error: 'Invalid cron expression' },
        { status: 400 }
      )
    }

    // Kullanıcının Exchange kullanıcısı olup olmadığını kontrol et
    const { data: exchangeUser } = await supabase
      .from('exchange_users')
      .select('id')
      .eq('user_principal_name', userPrincipalName)
      .single()

    if (!exchangeUser) {
      return NextResponse.json(
        { error: 'Exchange user not found' },
        { status: 404 }
      )
    }

    // Yeni yapılandırma oluştur
    const config: ScheduledBackupConfig = {
      id: uuidv4(),
      userId: exchangeUser.id,
      userPrincipalName,
      cronExpression,
      isActive: true,
      backupType,
      retentionDays,
      includeAttachments,
      maxEmailSize,
      zipBackups
    }

    // Zamanlanmış yedeklemeyi ekle
    await SchedulerServiceInstance.addScheduledBackup(config)

    return NextResponse.json({
      success: true,
      data: config,
      message: 'Scheduled backup configuration created successfully'
    })

  } catch (error) {
    console.error('Failed to create scheduled backup config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const PUT = requireAuth(async (
  request: NextRequest,
  user: AuthUser
) => {
  try {
    const body = await request.json()
    const { configId, ...updates } = body

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID is required' },
        { status: 400 }
      )
    }

    // Mevcut yapılandırmaları çek
    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'scheduled_backups')
      .single()

    if (!settings?.value) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    const configs: ScheduledBackupConfig[] = JSON.parse(settings.value)
    const configIndex = configs.findIndex(c => c.id === configId)

    if (configIndex === -1) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    // Yetki kontrolü (admin değilse sadece kendi yapılandırmasını güncelleyebilir)
    if (user.role !== 'admin' && configs[configIndex].userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Yapılandırmayı güncelle
    configs[configIndex] = { ...configs[configIndex], ...updates }

    // Veritabanını güncelle
    await supabase
      .from('system_settings')
      .update({
        value: JSON.stringify(configs),
        updated_at: new Date().toISOString()
      })
      .eq('key', 'scheduled_backups')

    // Zamanlamayı yeniden başlat
    if (configs[configIndex].isActive) {
      await SchedulerServiceInstance.scheduleBackup(configs[configIndex])
    } else {
      await SchedulerServiceInstance.removeScheduledBackup(configId)
    }

    return NextResponse.json({
      success: true,
      data: configs[configIndex],
      message: 'Scheduled backup configuration updated successfully'
    })

  } catch (error) {
    console.error('Failed to update scheduled backup config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const DELETE = requireAuth(async (
  request: NextRequest,
  user: AuthUser
) => {
  try {
    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('configId')

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID is required' },
        { status: 400 }
      )
    }

    // Mevcut yapılandırmaları çek
    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'scheduled_backups')
      .single()

    if (!settings?.value) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    const configs: ScheduledBackupConfig[] = JSON.parse(settings.value)
    const config = configs.find(c => c.id === configId)

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    // Yetki kontrolü (admin değilse sadece kendi yapılandırmasını silebilir)
    if (user.role !== 'admin' && config.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Zamanlanmış yedeklemeyi kaldır
    await SchedulerServiceInstance.removeScheduledBackup(configId)

    return NextResponse.json({
      success: true,
      message: 'Scheduled backup configuration deleted successfully'
    })

  } catch (error) {
    console.error('Failed to delete scheduled backup config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})