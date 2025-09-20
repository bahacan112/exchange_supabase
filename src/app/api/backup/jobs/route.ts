import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { BackupServiceInstance } from '@/lib/backup-service'
import { supabase } from '@/lib/supabase'

export const GET = requireAuth(async (request: NextRequest, user: any) => {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status')
    const userId = url.searchParams.get('userId')

    let query = supabase
      .from('backup_jobs')
      .select(`
        *,
        exchange_users (
          id,
          display_name,
          email,
          user_principal_name
        )
      `, { count: 'exact' })

    // Filtreler
    if (status) {
      query = query.eq('status', status)
    }

    if (userId) {
      query = query.eq('exchange_user_id', userId)
    }

    // Sayfalama
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: jobs, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    // Aktif job'ların progress bilgilerini ekle
    const jobsWithProgress = jobs?.map(job => {
      const progress = BackupServiceInstance.getJobProgress(job.id)
      return {
        ...job,
        progress: progress ? {
          status: progress.status,
          progress: progress.progress,
          currentFolder: progress.currentFolder,
          processedEmails: progress.processedEmails,
          totalEmails: progress.totalEmails,
          processedSize: progress.processedSize,
          errorCount: progress.errors.length
        } : null
      }
    }) || []

    // Aktif job'ları da ekle
    const activeJobs = BackupServiceInstance.getAllActiveJobs()

    return NextResponse.json({
      success: true,
      jobs: jobsWithProgress,
      activeJobs: activeJobs.map(job => ({
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        currentFolder: job.currentFolder,
        processedEmails: job.processedEmails,
        totalEmails: job.totalEmails,
        processedSize: job.processedSize,
        errorCount: job.errors.length
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Get backup jobs error:', error)
    return NextResponse.json(
      { error: 'Yedekleme işleri yüklenemedi: ' + (error as Error).message },
      { status: 500 }
    )
  }
})

// DELETE - Yedekleme işini iptal et veya sil
export const DELETE = requireAuth(async (request: NextRequest, user: any) => {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId gerekli' },
        { status: 400 }
      )
    }

    // Job'ı veritabanından sil
    const { error } = await supabase
      .from('backup_jobs')
      .delete()
      .eq('id', jobId)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Yedekleme işi silindi'
    })

  } catch (error) {
    console.error('Delete backup job error:', error)
    return NextResponse.json(
      { error: 'Yedekleme işi silinemedi: ' + (error as Error).message },
      { status: 500 }
    )
  }
})