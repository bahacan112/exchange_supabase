'use client'

import { useEffect, useState } from 'react'

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">İstatistikler yüklenirken hata oluştu.</p>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Toplam Kullanıcı',
      value: stats.totalUsers.toLocaleString(),
      icon: '👥',
      color: 'bg-blue-500'
    },
    {
      title: 'Aktif Yedekleme',
      value: stats.activeBackups.toString(),
      icon: '⚡',
      color: 'bg-green-500'
    },
    {
      title: 'Toplam Boyut',
      value: stats.totalBackupSize,
      icon: '💾',
      color: 'bg-purple-500'
    },
    {
      title: 'Başarı Oranı',
      value: `${stats.successRate}%`,
      icon: '📈',
      color: stats.successRate >= 90 ? 'bg-green-500' : stats.successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
    },
    {
      title: 'Zamanlanmış İş',
      value: stats.scheduledJobs.toString(),
      icon: '⏰',
      color: 'bg-indigo-500'
    },
    {
      title: 'Son Hatalar',
      value: stats.recentErrors.toString(),
      icon: '⚠️',
      color: stats.recentErrors === 0 ? 'bg-green-500' : 'bg-red-500'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statCards.map((card, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className={`${card.color} p-3 rounded-lg text-white text-xl mr-4`}>
              {card.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}