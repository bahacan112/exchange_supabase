'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { setUser, logoutUser, checkAuthStatus } from '@/store/slices/authSlice'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DashboardStats from '@/components/dashboard/DashboardStats'
import BackupJobsList from '@/components/dashboard/BackupJobsList'
import SchedulerStatus from '@/components/dashboard/SchedulerStatus'
import UsersList from '@/components/dashboard/UsersList'
import { BarChart3, Database, Clock, Users, LogOut, Server } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { user, isAuthenticated, loading: authLoading } = useSelector((state: RootState) => state.auth)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      // Auth durumu kontrol edilmemişse, checkAuthStatus'u çağır
      dispatch(checkAuthStatus()).then((result) => {
        if (!result.payload) {
          router.push('/login')
        }
        setLoading(false)
      })
    } else if (isAuthenticated) {
      setLoading(false)
    }
  }, [isAuthenticated, authLoading, dispatch, router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    dispatch(logoutUser())
    router.push('/login')
  }

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

  const tabs = [
    { id: 'overview', name: 'Genel Bakış', icon: BarChart3 },
    { id: 'backups', name: 'Yedeklemeler', icon: Database },
    { id: 'scheduler', name: 'Zamanlayıcı', icon: Clock },
    { id: 'users', name: 'Kullanıcılar', icon: Users }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Modern Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Exchange Backup Yönetimi</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {user.username}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Çıkış Yap</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Tabs */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            {tabs.map((tab) => {
              const IconComponent = tab.icon
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center space-x-2">
                  <IconComponent className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Toplam Yedekleme</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,234</div>
                  <p className="text-xs text-muted-foreground">+20.1% geçen aydan</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aktif İşler</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">+2 yeni iş</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Başarı Oranı</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">98.5%</div>
                  <p className="text-xs text-muted-foreground">+0.5% artış</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Depolama</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2.4 TB</div>
                  <p className="text-xs text-muted-foreground">%75 kullanımda</p>
                </CardContent>
              </Card>
            </div>
            <DashboardStats />
          </TabsContent>

          <TabsContent value="backups" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Yedekleme İşleri</CardTitle>
                <CardDescription>
                  Tüm yedekleme işlerinizi buradan yönetebilirsiniz
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BackupJobsList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduler" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Zamanlayıcı Durumu</CardTitle>
                <CardDescription>
                  Otomatik yedekleme zamanlamalarını kontrol edin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SchedulerStatus />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Kullanıcı Yönetimi</CardTitle>
                <CardDescription>
                  Sistem kullanıcılarını yönetin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UsersList />
              </CardContent>
            </Card>
          </TabsContent>
      </main>
    </div>
  )
}