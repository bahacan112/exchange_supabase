'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Clock, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle, 
  Settings, 
  Trash2, 
  Plus,
  Calendar,
  Archive,
  RefreshCw,
  XCircle
} from 'lucide-react'

interface SchedulerData {
  scheduler: {
    isRunning: boolean
    activeTaskCount: number
    totalConfigs: number
    activeConfigs: number
  }
  jobs: {
    total: number
    completed: number
    failed: number
    running: number
  }
  errors: {
    recentCount: number
    recentErrors: Array<{
      configId: string
      userPrincipalName: string
      error: string
      timestamp: string
    }>
  }
  trends: {
    daily: { [key: string]: { completed: number; failed: number } }
  }
}

interface ScheduledConfig {
  id: string
  userId: string
  userPrincipalName: string
  cronExpression: string
  isActive: boolean
  backupType: 'incremental' | 'full'
  retentionDays: number
  includeAttachments: boolean
  zipBackups: boolean
  lastRun?: string
  nextRun?: string
}

interface SchedulerStatusProps {
  detailed?: boolean
}

export default function SchedulerStatus({ detailed = false }: SchedulerStatusProps) {
  const router = useRouter()
  const [data, setData] = useState<SchedulerData | null>(null)
  const [configs, setConfigs] = useState<ScheduledConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    if (detailed) {
      fetchConfigs()
    }
  }, [detailed])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scheduler/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch scheduler status:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scheduler/config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setConfigs(result.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch scheduler configs:', error)
    }
  }

  const handleRestartScheduler = async () => {
    if (!confirm('Zamanlayıcıyı yeniden başlatmak istediğinizden emin misiniz?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scheduler/status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'restart_scheduler' })
      })

      if (response.ok) {
        alert('Zamanlayıcı başarıyla yeniden başlatıldı')
        fetchData()
      } else {
        alert('Zamanlayıcı yeniden başlatılırken hata oluştu')
      }
    } catch (error) {
      console.error('Failed to restart scheduler:', error)
      alert('Zamanlayıcı yeniden başlatılırken hata oluştu')
    }
  }

  const handleClearErrors = async () => {
    if (!confirm('Tüm hata loglarını temizlemek istediğinizden emin misiniz?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scheduler/status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'clear_errors' })
      })

      if (response.ok) {
        alert('Hata logları başarıyla temizlendi')
        fetchData()
      } else {
        alert('Hata logları temizlenirken hata oluştu')
      }
    } catch (error) {
      console.error('Failed to clear errors:', error)
      alert('Hata logları temizlenirken hata oluştu')
    }
  }

  const toggleConfig = async (configId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scheduler/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ configId, isActive: !isActive })
      })

      if (response.ok) {
        fetchConfigs()
        fetchData()
      } else {
        alert('Yapılandırma güncellenirken hata oluştu')
      }
    } catch (error) {
      console.error('Failed to toggle config:', error)
      alert('Yapılandırma güncellenirken hata oluştu')
    }
  }

  const deleteConfig = async (configId: string) => {
    if (!confirm('Bu zamanlanmış yedeklemeyi silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/scheduler/config?configId=${configId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setConfigs(configs.filter(c => c.id !== configId))
        fetchData()
      } else {
        alert('Yapılandırma silinirken hata oluştu')
      }
    } catch (error) {
      console.error('Failed to delete config:', error)
      alert('Yapılandırma silinirken hata oluştu')
    }
  }

  const formatCronExpression = (cron: string) => {
    // Basit cron ifadesi açıklaması
    const parts = cron.split(' ')
    if (parts.length === 5) {
      const [minute, hour, day, month, weekday] = parts
      
      if (minute === '0' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
        return `Her gün saat ${hour}:00`
      }
      if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
        return `Her gün saat ${hour}:${minute.padStart(2, '0')}`
      }
    }
    return cron
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Zamanlayıcı Durumu
            </CardTitle>
            <CardDescription>
              Otomatik yedekleme zamanlayıcısının durumu ve istatistikleri
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="text-center space-y-2">
                    <Skeleton className="h-8 w-16 mx-auto" />
                    <Skeleton className="h-4 w-20 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Zamanlayıcı durumu yüklenirken hata oluştu.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Genel Durum */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Zamanlayıcı Durumu
          </CardTitle>
          <CardDescription>
            Otomatik yedekleme zamanlayıcısının durumu ve istatistikleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${data.scheduler.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <Badge variant={data.scheduler.isRunning ? 'default' : 'destructive'} className="flex items-center gap-1">
                {data.scheduler.isRunning ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                {data.scheduler.isRunning ? 'Çalışıyor' : 'Durduruldu'}
              </Badge>
            </div>
            {detailed && (
              <div className="flex gap-2">
                <Button onClick={handleRestartScheduler} size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Yeniden Başlat
                </Button>
                {data.errors.recentCount > 0 && (
                  <Button onClick={handleClearErrors} variant="destructive" size="sm">
                    <XCircle className="mr-2 h-4 w-4" />
                    Hataları Temizle
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-muted-foreground">Aktif Görev</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{data.scheduler.activeTaskCount}</div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-muted-foreground">Aktif Yapılandırma</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{data.scheduler.activeConfigs}</div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-muted-foreground">Tamamlanan İş</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">{data.jobs.completed}</div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-muted-foreground">Son Hatalar</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{data.errors.recentCount}</div>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Son Hatalar */}
      {data.errors.recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Son Hatalar
            </CardTitle>
            <CardDescription>
              Zamanlayıcı tarafından kaydedilen son hatalar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.errors.recentErrors.slice(0, detailed ? 10 : 3).map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="font-medium">{error.userPrincipalName}</div>
                        <div className="text-sm">{error.error}</div>
                      </div>
                      <div className="text-xs opacity-70">
                        {new Date(error.timestamp).toLocaleString('tr-TR')}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zamanlanmış Yapılandırmalar (Detaylı görünümde) */}
      {detailed && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Zamanlanmış Yedeklemeler
                </CardTitle>
                <CardDescription>
                  Otomatik yedekleme yapılandırmaları ve zamanlamaları
                </CardDescription>
              </div>
              <Button onClick={() => router.push('/dashboard/scheduler/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {configs.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz zamanlanmış yedekleme yok</h3>
                <p className="text-gray-500 mb-6">İlk otomatik yedekleme yapılandırmanızı oluşturun</p>
                <Button onClick={() => router.push('/dashboard/scheduler/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  İlk Yapılandırmayı Oluştur
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>Zamanlama</TableHead>
                      <TableHead>Tür</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Son Çalışma</TableHead>
                      <TableHead className="text-right">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{config.userPrincipalName}</div>
                            <div className="text-sm text-muted-foreground">
                              {config.retentionDays} gün saklama
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {formatCronExpression(config.cronExpression)}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {config.cronExpression}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={config.backupType === 'full' ? 'default' : 'secondary'}>
                              <Archive className="mr-1 h-3 w-3" />
                              {config.backupType === 'full' ? 'Tam' : 'Artırımlı'}
                            </Badge>
                            {config.zipBackups && (
                              <Badge variant="outline">
                                <Archive className="mr-1 h-3 w-3" />
                                ZIP
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.isActive ? 'default' : 'secondary'}>
                            {config.isActive ? <Play className="mr-1 h-3 w-3" /> : <Pause className="mr-1 h-3 w-3" />}
                            {config.isActive ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {config.lastRun ? new Date(config.lastRun).toLocaleString('tr-TR') : 'Henüz çalışmadı'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleConfig(config.id, config.isActive)}
                            >
                              {config.isActive ? (
                                <>
                                  <Pause className="mr-1 h-3 w-3" />
                                  Durdur
                                </>
                              ) : (
                                <>
                                  <Play className="mr-1 h-3 w-3" />
                                  Başlat
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteConfig(config.id)}
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}