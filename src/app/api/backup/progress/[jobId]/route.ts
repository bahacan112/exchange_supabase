import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthUser } from '@/lib/auth'
import { BackupServiceInstance } from '@/lib/backup-service'
import { supabase } from '@/lib/supabase'

export const GET = requireAuth(async (
  request: NextRequest,
  user: AuthUser,
  context: { params: { jobId: string } }
) => {
  try {
    const { params } = context
    const jobId = params?.jobId

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Veritabanından job bilgilerini çek
    const { data: job, error } = await supabase
      .from('backup_jobs')
      .select(`
        *,
        exchange_users (
          id,
          display_name,
          email,
          user_principal_name
        )
      `)
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return NextResponse.json(
        { error: 'Yedekleme işi bulunamadı' },
        { status: 404 }
      )
    }

    // Aktif job progress bilgilerini çek
    const progress = BackupServiceInstance.getJobProgress(jobId)

    // Email ve attachment istatistiklerini çek
    const { data: emailStats } = await supabase
      .from('emails')
      .select('count(*), sum(backup_size)')
      .eq('user_id', job.user_id)
      .gte('backup_date', job.created_at) as { data: Array<{ count: number; sum: number }> | null }

    const { data: attachmentStats } = await supabase
      .from('email_attachments')
      .select('count(*), sum(size)')
      .eq('email_id', 'any') as { data: Array<{ count: number; sum: number }> | null } // Bu kısım daha detaylı join gerektirebilir

    const response = {
      success: true,
      job: {
        id: job.id,
        status: job.status,
        backupType: job.backup_type,
        startDate: job.start_date,
        endDate: job.end_date,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        errorMessage: job.error_message,
        settings: job.settings,
        user: job.exchange_users
      },
      progress: progress ? {
        status: progress.status,
        progress: progress.progress,
        currentFolder: progress.currentFolder,
        processedEmails: progress.processedEmails,
        totalEmails: progress.totalEmails,
        processedSize: progress.processedSize,
        errors: progress.errors
      } : null,
      statistics: {
        totalEmails: emailStats?.[0]?.count || 0,
        totalSize: emailStats?.[0]?.sum || 0,
        totalAttachments: attachmentStats?.[0]?.count || 0,
        attachmentSize: attachmentStats?.[0]?.sum || 0
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Get backup progress error:', error)
    return NextResponse.json(
      { error: 'Yedekleme ilerlemesi alınamadı: ' + (error as Error).message },
      { status: 500 }
    )
  }
})