'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, CheckCircle2, Clock, Play, Trash2, Eye, Mail, Paperclip, Calendar, Timer } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"

interface BackupJob {
  id: string
  exchange_user_id: string
  user_principal_name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  total_emails: number
  processed_emails: number
  total_attachments: number
  processed_attachments: number
  created_at: string
  completed_at?: string
  error_message?: string
}

interface BackupJobsListProps {
  limit?: number
}

export default function BackupJobsList({ limit }: BackupJobsListProps) {
  const router = useRouter()
  const [jobs, setJobs] = useState<BackupJob[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchJobs = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        page: currentPage.toString(),
        ...(limit && { limit: limit.toString() })
      })

      const response = await fetch(`/api/backup/jobs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setJobs(data.data || [])
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Failed to fetch backup jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, limit])

  useEffect(() => {
    fetchJobs()
  }, [currentPage, limit, fetchJobs])

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Bu yedekleme işini silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/backup/jobs?jobId=${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setJobs(jobs.filter(job => job.id !== jobId))
      } else {
        alert('İş silinirken hata oluştu')
      }
    } catch (error) {
      console.error('Failed to delete job:', error)
      alert('İş silinirken hata oluştu')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { 
        variant: 'secondary' as const, 
        text: 'Bekliyor', 
        icon: Clock,
        className: 'bg-yellow-50 text-yellow-700 border-yellow-200'
      },
      running: { 
        variant: 'default' as const, 
        text: 'Çalışıyor', 
        icon: Play,
        className: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      completed: { 
        variant: 'default' as const, 
        text: 'Tamamlandı', 
        icon: CheckCircle2,
        className: 'bg-green-50 text-green-700 border-green-200'
      },
      failed: { 
        variant: 'destructive' as const, 
        text: 'Başarısız', 
        icon: AlertCircle,
        className: 'bg-red-50 text-red-700 border-red-200'
      }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={`${config.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR')
  }

  const formatDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffHours > 0) {
      return `${diffHours}s ${diffMins % 60}dk`
    }
    return `${diffMins}dk`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Yedekleme İşleri
          </CardTitle>
          <CardDescription>
            Exchange mailbox yedekleme işlerinin durumu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(limit || 5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/6" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/6" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Yedekleme İşleri
        </CardTitle>
        <CardDescription>
          Exchange mailbox yedekleme işlerinin durumu
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz yedekleme işi yok</h3>
            <p className="text-gray-500 mb-6">İlk yedekleme işinizi başlatarak başlayın</p>
            <Button onClick={() => router.push('/dashboard/backup/new')}>
              <Play className="mr-2 h-4 w-4" />
              İlk Yedeklemeyi Başlat
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Kullanıcı</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>İlerleme</TableHead>
                    <TableHead>Başlangıç</TableHead>
                    <TableHead>Süre</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{job.user_principal_name}</div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {job.processed_emails}/{job.total_emails}
                            </div>
                            <div className="flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              {job.processed_attachments}/{job.total_attachments}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {getStatusBadge(job.status)}
                          {job.error_message && (
                            <Alert className="p-2">
                              <AlertCircle className="h-3 w-3" />
                              <AlertDescription className="text-xs">
                                {job.error_message.substring(0, 50)}...
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Progress 
                            value={job.progress} 
                            className="w-full"
                          />
                          <div className="text-xs text-muted-foreground">
                            {job.progress}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(job.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Timer className="h-3 w-3" />
                          {formatDuration(job.created_at, job.completed_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {job.status === 'running' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/dashboard/backup/progress/${job.id}`)}
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              Detay
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteJob(job.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Sil
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {!limit && totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Sayfa {currentPage} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Önceki
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}