'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Zamanlayıcı durumu yüklenirken hata oluştu.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Genel Durum */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Zamanlayıcı Durumu</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${data.scheduler.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-sm font-medium ${data.scheduler.isRunning ? 'text-green-700' : 'text-red-700'}`}>
              {data.scheduler.isRunning ? 'Çalışıyor' : 'Durduruldu'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{data.scheduler.activeTaskCount}</div>
            <div className="text-sm text-gray-500">Aktif Görev</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.scheduler.activeConfigs}</div>
            <div className="text-sm text-gray-500">Aktif Yapılandırma</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{data.jobs.completed}</div>
            <div className="text-sm text-gray-500">Tamamlanan İş</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{data.errors.recentCount}</div>
            <div className="text-sm text-gray-500">Son Hatalar</div>
          </div>
        </div>

        {detailed && (
          <div className="flex space-x-2">
            <button
              onClick={handleRestartScheduler}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Yeniden Başlat
            </button>
            {data.errors.recentCount > 0 && (
              <button
                onClick={handleClearErrors}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Hataları Temizle
              </button>
            )}
          </div>
        )}
      </div>

      {/* Son Hatalar */}
      {data.errors.recentErrors.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Son Hatalar</h4>
          <div className="space-y-3">
            {data.errors.recentErrors.slice(0, detailed ? 10 : 3).map((error, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-red-800">{error.userPrincipalName}</div>
                    <div className="text-sm text-red-600">{error.error}</div>
                  </div>
                  <div className="text-xs text-red-500">
                    {new Date(error.timestamp).toLocaleString('tr-TR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zamanlanmış Yapılandırmalar (Detaylı görünümde) */}
      {detailed && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-medium text-gray-900">Zamanlanmış Yedeklemeler</h4>
            <button
              onClick={() => router.push('/dashboard/scheduler/new')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Yeni Ekle
            </button>
          </div>

          {configs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Henüz zamanlanmış yedekleme bulunmuyor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kullanıcı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zamanlama
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tür
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Son Çalışma
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {configs.map((config) => (
                    <tr key={config.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {config.userPrincipalName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {config.retentionDays} gün saklama
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCronExpression(config.cronExpression)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {config.cronExpression}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          config.backupType === 'full' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {config.backupType === 'full' ? 'Tam' : 'Artırımlı'}
                        </span>
                        {config.zipBackups && (
                          <span className="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            ZIP
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          config.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {config.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {config.lastRun ? new Date(config.lastRun).toLocaleString('tr-TR') : 'Henüz çalışmadı'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => toggleConfig(config.id, config.isActive)}
                            className={`${
                              config.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                            }`}
                          >
                            {config.isActive ? 'Durdur' : 'Başlat'}
                          </button>
                          <button
                            onClick={() => deleteConfig(config.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}