'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/lib/redux/store'

interface BackupJob {
  id: string
  user_email: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  created_at: string
  started_at?: string
  completed_at?: string
  error_message?: string
  total_emails: number
  processed_emails: number
  backup_size: number
  idrive_path?: string
}

interface BackupProgress {
  jobId: string
  status: string
  totalEmails: number
  processedEmails: number
  currentEmail?: string
  estimatedTimeRemaining?: number
  backupSize: number
  errors: string[]
}

export default function BackupJobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useSelector((state: RootState) => state.auth)
  const [job, setJob] = useState<BackupJob | null>(null)
  const [progress, setProgress] = useState<BackupProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const jobId = params.jobId as string

  const fetchJobDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/backup/jobs?jobId=${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.jobs && data.jobs.length > 0) {
          setJob(data.jobs[0])
        } else {
          setError('Yedekleme işi bulunamadı')
        }
      } else {
        setError('Yedekleme işi bilgileri alınamadı')
      }
    } catch (error) {
      console.error('Error fetching job details:', error)
      setError('Bağlantı hatası oluştu')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/backup/progress/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setProgress(data)
      }
    } catch (error) {
      console.error('Error fetching progress:', error)
    }
  }, [jobId])

  useEffect(() => {
    if (!user || !jobId) {
      router.push('/login')
      return
    }

    fetchJobDetails()

    // Progress için polling
    const interval = setInterval(() => {
      if (job?.status === 'running') {
        fetchProgress()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [user, jobId, job?.status, fetchJobDetails, fetchProgress, router])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}s ${minutes}d ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}d ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Bekliyor'
      case 'running': return 'Çalışıyor'
      case 'completed': return 'Tamamlandı'
      case 'failed': return 'Başarısız'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error || 'Yedekleme işi bulunamadı'}</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Dashboard&apos;a Dön
          </button>
        </div>
      </div>
    )
  }

  const progressPercentage = job.total_emails > 0 
    ? Math.round((job.processed_emails / job.total_emails) * 100) 
    : 0

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard&apos;a Dön
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Yedekleme İşi Detayları</h1>
          <p className="text-gray-600 mt-2">İş ID: {job.id}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ana Bilgiler */}
          <div className="lg:col-span-2 space-y-6">
            {/* Durum Kartı */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Genel Durum</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Kullanıcı</label>
                  <p className="text-lg text-gray-900">{job.user_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Durum</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                    {getStatusText(job.status)}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Oluşturulma</label>
                  <p className="text-sm text-gray-900">{new Date(job.created_at).toLocaleString('tr-TR')}</p>
                </div>
                {job.started_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Başlangıç</label>
                    <p className="text-sm text-gray-900">{new Date(job.started_at).toLocaleString('tr-TR')}</p>
                  </div>
                )}
                {job.completed_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tamamlanma</label>
                    <p className="text-sm text-gray-900">{new Date(job.completed_at).toLocaleString('tr-TR')}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Yedekleme Boyutu</label>
                  <p className="text-lg text-gray-900">{formatFileSize(job.backup_size)}</p>
                </div>
              </div>
            </div>

            {/* İlerleme Kartı */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">İlerleme Durumu</h2>
              
              {/* İlerleme Çubuğu */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>İşlenen E-postalar</span>
                  <span>{job.processed_emails} / {job.total_emails} (%{progressPercentage})</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Canlı İlerleme Bilgileri */}
              {progress && job.status === 'running' && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="font-medium text-gray-900">Canlı İlerleme</h3>
                  {progress.currentEmail && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Şu An İşlenen</label>
                      <p className="text-sm text-gray-900">{progress.currentEmail}</p>
                    </div>
                  )}
                  {progress.estimatedTimeRemaining && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Tahmini Kalan Süre</label>
                      <p className="text-sm text-gray-900">{formatDuration(progress.estimatedTimeRemaining)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hata Mesajları */}
            {(job.error_message || (progress?.errors && progress.errors.length > 0)) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Hatalar</h2>
                <div className="space-y-2">
                  {job.error_message && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-800">{job.error_message}</p>
                    </div>
                  )}
                  {progress?.errors?.map((error, index) => (
                    <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm text-yellow-800">{error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Yan Panel */}
          <div className="space-y-6">
            {/* İstatistikler */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">İstatistikler</h2>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Toplam E-posta</span>
                  <span className="text-sm font-medium text-gray-900">{job.total_emails.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">İşlenen</span>
                  <span className="text-sm font-medium text-gray-900">{job.processed_emails.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Kalan</span>
                  <span className="text-sm font-medium text-gray-900">{(job.total_emails - job.processed_emails).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Başarı Oranı</span>
                  <span className="text-sm font-medium text-gray-900">%{progressPercentage}</span>
                </div>
              </div>
            </div>

            {/* IDrive Bilgileri */}
            {job.idrive_path && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Depolama</h2>
                <div>
                  <label className="text-sm font-medium text-gray-500">IDrive Yolu</label>
                  <p className="text-sm text-gray-900 break-all">{job.idrive_path}</p>
                </div>
              </div>
            )}

            {/* Eylemler */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Eylemler</h2>
              <div className="space-y-3">
                <button
                  onClick={fetchJobDetails}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  Yenile
                </button>
                {job.status === 'completed' && (
                  <button
                    onClick={() => {
                      // İndirme işlemi burada yapılabilir
                      alert('İndirme özelliği yakında eklenecek')
                    }}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                  >
                    Yedeklemeyi İndir
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}