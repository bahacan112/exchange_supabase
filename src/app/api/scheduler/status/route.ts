import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthUser } from '@/lib/auth'
import { SchedulerServiceInstance } from '@/lib/scheduler-service'
import { supabase } from '@/lib/supabase'

export const GET = requireAuth(async (
  request: NextRequest,
  user: AuthUser
) => {
  try {
    // Aktif zamanlanmış görevleri çek
    const scheduledTasks = SchedulerServiceInstance.getScheduledTasks()
    const activeTaskCount = scheduledTasks.size

    // Zamanlanmış yedekleme yapılandırmalarını çek
    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'scheduled_backups')
      .single()

    let totalConfigs = 0
    let activeConfigs = 0
    let recentErrors: any[] = []

    if (settings?.value) {
      const configs = JSON.parse(settings.value)
      totalConfigs = configs.length
      activeConfigs = configs.filter((c: any) => c.isActive).length

      // Son 24 saatteki hataları çek
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      for (const config of configs) {
        try {
          const { data: errorLog } = await supabase
            .from('system_settings')
            .select('*')
            .eq('key', `backup_error_${config.id}`)
            .single()

          if (errorLog?.value) {
            const errorData = JSON.parse(errorLog.value)
            if (errorData.timestamp > oneDayAgo) {
              recentErrors.push({
                configId: config.id,
                userPrincipalName: config.userPrincipalName,
                error: errorData.error,
                timestamp: errorData.timestamp
              })
            }
          }
        } catch (error) {
          // Hata logu yoksa devam et
        }
      }
    }

    // Son 7 gündeki backup job istatistikleri
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: recentJobs } = await supabase
      .from('backup_jobs')
      .select('status, created_at, user_id')
      .gte('created_at', sevenDaysAgo)

    const jobStats = {
      total: recentJobs?.length || 0,
      completed: recentJobs?.filter(j => j.status === 'completed').length || 0,
      failed: recentJobs?.filter(j => j.status === 'failed').length || 0,
      running: recentJobs?.filter(j => j.status === 'running').length || 0
    }

    // Disk kullanımı istatistikleri
    const { data: diskUsage } = await supabase
      .from('emails')
      .select('backup_size')
      .not('backup_size', 'is', null)

    const totalBackupSize = diskUsage?.reduce((sum, email) => sum + (email.backup_size || 0), 0) || 0

    // Günlük backup trendi (son 30 gün)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: dailyStats } = await supabase
      .from('backup_jobs')
      .select('created_at, status')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true })

    const dailyTrend: { [key: string]: { completed: number; failed: number } } = {}
    
    if (dailyStats) {
      for (const job of dailyStats) {
        const date = job.created_at.split('T')[0]
        if (!dailyTrend[date]) {
          dailyTrend[date] = { completed: 0, failed: 0 }
        }
        
        if (job.status === 'completed') {
          dailyTrend[date].completed++
        } else if (job.status === 'failed') {
          dailyTrend[date].failed++
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        scheduler: {
          isRunning: true,
          activeTaskCount,
          totalConfigs,
          activeConfigs
        },
        jobs: jobStats,
        storage: {
          totalBackupSize,
          totalBackupSizeFormatted: formatBytes(totalBackupSize)
        },
        errors: {
          recentCount: recentErrors.length,
          recentErrors: recentErrors.slice(0, 10) // Son 10 hata
        },
        trends: {
          daily: dailyTrend
        }
      }
    })

  } catch (error) {
    console.error('Failed to get scheduler status:', error)
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
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'restart_scheduler':
        // Scheduler'ı yeniden başlat
        await SchedulerServiceInstance.initializeScheduledBackups()
        return NextResponse.json({
          success: true,
          message: 'Scheduler restarted successfully'
        })

      case 'clear_errors':
        // Hata loglarını temizle
        const { data: errorSettings } = await supabase
          .from('system_settings')
          .select('key')
          .like('key', 'backup_error_%')

        if (errorSettings) {
          for (const setting of errorSettings) {
            await supabase
              .from('system_settings')
              .delete()
              .eq('key', setting.key)
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Error logs cleared successfully'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Failed to execute scheduler action:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}