'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, Activity, HardDrive, TrendingUp, Clock, AlertTriangle } from 'lucide-react'

interface Stats {
  totalUsers: number
  activeBackups: number
  totalBackupSize: string
  successRate: number
  scheduledJobs: number
  recentErrors: number
}

export default function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scheduler/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        
        // Kullanıcı sayısını al
        const usersResponse = await fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        let totalUsers = 0
        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          totalUsers = usersData.data?.length || 0
        }

        const successRate = data.data.jobs.total > 0 
          ? Math.round((data.data.jobs.completed / data.data.jobs.total) * 100)
          : 100

        setStats({
          totalUsers,
          activeBackups: data.data.jobs.running,
          totalBackupSize: data.data.storage.totalBackupSizeFormatted,
          successRate,
          scheduledJobs: data.data.scheduler.activeConfigs,
          recentErrors: data.data.errors.recentCount
        })
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 w-4 bg-muted rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <p>İstatistikler yüklenirken hata oluştu.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const statCards = [
    {
      title: 'Toplam Kullanıcı',
      value: stats.totalUsers.toLocaleString(),
      description: 'Kayıtlı kullanıcı sayısı',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      trend: '+12% bu ay'
    },
    {
      title: 'Aktif Yedekleme',
      value: stats.activeBackups.toString(),
      description: 'Şu anda çalışan işlemler',
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      trend: stats.activeBackups > 0 ? 'Aktif' : 'Beklemede'
    },
    {
      title: 'Toplam Boyut',
      value: stats.totalBackupSize,
      description: 'Depolanan veri miktarı',
      icon: HardDrive,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      trend: '+2.5GB bu hafta'
    },
    {
      title: 'Başarı Oranı',
      value: `${stats.successRate}%`,
      description: 'Tamamlanan işlem oranı',
      icon: TrendingUp,
      color: stats.successRate >= 90 ? 'text-green-600' : stats.successRate >= 70 ? 'text-yellow-600' : 'text-red-600',
      bgColor: stats.successRate >= 90 ? 'bg-green-50' : stats.successRate >= 70 ? 'bg-yellow-50' : 'bg-red-50',
      trend: stats.successRate >= 90 ? 'Mükemmel' : stats.successRate >= 70 ? 'İyi' : 'Dikkat',
      progress: stats.successRate
    },
    {
      title: 'Zamanlanmış İş',
      value: stats.scheduledJobs.toString(),
      description: 'Aktif zamanlama sayısı',
      icon: Clock,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      trend: 'Otomatik çalışıyor'
    },
    {
      title: 'Son Hatalar',
      value: stats.recentErrors.toString(),
      description: 'Son 24 saatteki hata sayısı',
      icon: AlertTriangle,
      color: stats.recentErrors === 0 ? 'text-green-600' : 'text-red-600',
      bgColor: stats.recentErrors === 0 ? 'bg-green-50' : 'bg-red-50',
      trend: stats.recentErrors === 0 ? 'Sorun yok' : 'İnceleme gerekli'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Ana İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => {
          const IconComponent = card.icon
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <IconComponent className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">{card.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      card.trend === 'Mükemmel' || card.trend === 'Sorun yok' || card.trend === 'Aktif' 
                        ? 'default' 
                        : card.trend === 'İyi' || card.trend === 'Otomatik çalışıyor'
                        ? 'secondary'
                        : card.trend === 'Dikkat' || card.trend === 'İnceleme gerekli'
                        ? 'destructive'
                        : 'outline'
                    }
                    className="text-xs"
                  >
                    {card.trend}
                  </Badge>
                </div>
                {card.progress !== undefined && (
                  <div className="mt-3">
                    <Progress value={card.progress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Özet Bilgi Kartı */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Sistem Durumu Özeti</span>
          </CardTitle>
          <CardDescription>
            Exchange Online yedekleme sisteminizin genel performans göstergeleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{stats.totalUsers}</div>
              <div className="text-sm text-muted-foreground">Toplam Kullanıcı</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{stats.scheduledJobs}</div>
              <div className="text-sm text-muted-foreground">Aktif Zamanlama</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{stats.successRate}%</div>
              <div className="text-sm text-muted-foreground">Başarı Oranı</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}