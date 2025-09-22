'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { setUser, logoutUser, checkAuthStatus } from '@/store/slices/authSlice'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SidebarTrigger } from '@/components/ui/sidebar'
import DashboardStats from '@/components/dashboard/DashboardStats'
import BackupJobsList from '@/components/dashboard/BackupJobsList'
import SchedulerStatus from '@/components/dashboard/SchedulerStatus'
import UsersList from '@/components/dashboard/UsersList'
import { BarChart3, Database, Clock, Users, LogOut, Server } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatch = useDispatch<AppDispatch>()
  const { user, isAuthenticated, loading: authLoading } = useSelector((state: RootState) => state.auth)
  const [loading, setLoading] = useState(true)
  
  // URL'den tab parametresini al, yoksa 'overview' kullan
  const activeTab = searchParams.get('tab') || 'overview'

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      // Auth durumu kontrol edilmemişse, checkAuthStatus'u çağır
      dispatch(checkAuthStatus()).then((result: any) => {
        if (!result.payload) {
          router.push('/login')
        }
        setLoading(false)
      })
    } else if (isAuthenticated) {
      setLoading(false)
    }
  }, [isAuthenticated, authLoading, dispatch, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-[300px]">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Yükleniyor...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  // Aktif tab'a göre hangi component'i göstereceğimizi belirle
  const renderActiveContent = () => {
    switch (activeTab) {
      case 'backups':
        return <BackupJobsList />
      case 'scheduler':
        return <SchedulerStatus />
      case 'users':
        return <UsersList />
      case 'overview':
      default:
        return <DashboardStats />
    }
  }

  // Aktif tab'ın başlığını belirle
  const getActiveTitle = () => {
    switch (activeTab) {
      case 'backups':
        return 'Yedeklemeler'
      case 'scheduler':
        return 'Zamanlayıcı'
      case 'users':
        return 'Kullanıcılar'
      case 'overview':
      default:
        return 'Genel Bakış'
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Modern Header with Sidebar Trigger */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6">
          <SidebarTrigger className="mr-4" />
          <div className="flex items-center space-x-2">
            <Server className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">{getActiveTitle()}</h1>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {user.username}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="space-y-6">
          {/* Welcome Section */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Hoş Geldiniz, {user.username}!</h2>
            <p className="text-muted-foreground">
              Exchange Online yedekleme sisteminizin {getActiveTitle().toLowerCase()} bölümündesiniz.
            </p>
          </div>

          {/* Active Content */}
          <div className="space-y-6">
            {renderActiveContent()}
          </div>
        </div>
      </main>
    </div>
  )
}