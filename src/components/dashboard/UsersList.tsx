'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Search, RefreshCw, Download, User, Mail, Building, Calendar, ChevronLeft, ChevronRight, UserCheck, UserX, Clock, AlertCircle } from "lucide-react"

interface ExchangeUser {
  id: string
  user_principal_name: string
  display_name: string
  email: string
  job_title?: string
  department?: string
  office_location?: string
  is_active: boolean
  last_sync_date: string
  created_at: string
  updated_at: string
}

export default function UsersList() {
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState<ExchangeUser[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.data || [])
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm])

  useEffect(() => {
    fetchUsers()
  }, [currentPage, searchTerm, fetchUsers])

  const handleSyncAllUsers = async () => {
    if (!confirm('Tüm Exchange kullanıcılarını senkronize etmek istediğinizden emin misiniz? Bu işlem uzun sürebilir.')) {
      return
    }

    setSyncing(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/sync/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        if (result.results.errors === 0) {
          toast({
            title: "Senkronizasyon Başarılı",
            description: `${result.results.created} yeni kullanıcı eklendi, ${result.results.updated} kullanıcı güncellendi.`,
          })
        } else {
          toast({
            title: "Senkronizasyon Tamamlandı",
            description: `${result.results.errors} hata oluştu. Detaylar için konsolu kontrol edin.`,
            variant: "destructive",
          })
        }
        fetchUsers()
      } else {
        const error = await response.json()
        toast({
          title: "Senkronizasyon Hatası",
          description: error.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Failed to sync users:', error)
      toast({
        title: "Hata",
        description: "Senkronizasyon sırasında hata oluştu",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncUser = async (userPrincipalName: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/sync/user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userPrincipalName })
      })

      if (response.ok) {
        toast({
          title: "Başarılı",
          description: "Kullanıcı başarıyla senkronize edildi",
        })
        fetchUsers()
      } else {
        const error = await response.json()
        toast({
          title: "Senkronizasyon Hatası",
          description: error.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Failed to sync user:', error)
      toast({
        title: "Hata",
        description: "Senkronizasyon sırasında hata oluştu",
        variant: "destructive",
      })
    }
  }

  const handleStartBackup = async (userId: string, userPrincipalName: string) => {
    const startDate = prompt('Başlangıç tarihi (YYYY-MM-DD formatında, boş bırakırsanız otomatik belirlenir):')
    let parsedStartDate: Date | undefined
    
    if (startDate) {
      parsedStartDate = new Date(startDate)
      if (isNaN(parsedStartDate.getTime())) {
        toast({
          title: "Hata",
          description: "Geçersiz tarih formatı",
          variant: "destructive",
        })
        return
      }
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/backup/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          userPrincipalName,
          startDate: parsedStartDate?.toISOString(),
          endDate: new Date().toISOString(),
          includeAttachments: true,
          maxEmailSize: 25 * 1024 * 1024 // 25MB
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Başarılı",
          description: "Yedekleme başlatıldı",
        })
        router.push(`/dashboard/backup/progress/${result.data.jobId}`)
      } else {
        const error = await response.json()
        toast({
          title: "Yedekleme Hatası",
          description: error.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Failed to start backup:', error)
      toast({
        title: "Hata",
        description: "Yedekleme başlatılırken hata oluştu",
        variant: "destructive",
      })
    }
  }

  const handleBulkBackup = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "Uyarı",
        description: "Lütfen en az bir kullanıcı seçin",
        variant: "destructive",
      })
      return
    }

    if (!confirm(`${selectedUsers.length} kullanıcı için yedekleme başlatmak istediğinizden emin misiniz?`)) {
      return
    }

    for (const userId of selectedUsers) {
      const user = users.find(u => u.id === userId)
      if (user) {
        try {
          const token = localStorage.getItem('token')
          await fetch('/api/backup/start', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user.id,
              userPrincipalName: user.user_principal_name,
              endDate: new Date().toISOString(),
              includeAttachments: true,
              maxEmailSize: 25 * 1024 * 1024
            })
          })
        } catch (error) {
          console.error(`Failed to start backup for ${user.user_principal_name}:`, error)
        }
      }
    }

    toast({
      title: "Başarılı",
      description: "Toplu yedekleme işleri başlatıldı",
    })
    setSelectedUsers([])
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(users.map(u => u.id))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR')
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Exchange Kullanıcıları
          </CardTitle>
          <CardDescription>
            Kullanıcı bilgileri yükleniyor...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
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
          <Users className="h-5 w-5" />
          Exchange Kullanıcıları
        </CardTitle>
        <CardDescription>
          Exchange sunucusundaki kullanıcıları görüntüleyin ve yönetin
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Arama ve İşlemler */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex-1 max-w-lg relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Kullanıcı ara..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10"
            />
          </div>
          <div className="flex space-x-2">
            {selectedUsers.length > 0 && (
              <Button onClick={handleBulkBackup} className="bg-green-600 hover:bg-green-700">
                <Download className="mr-2 h-4 w-4" />
                Seçilenleri Yedekle ({selectedUsers.length})
              </Button>
            )}
            <Button
              onClick={handleSyncAllUsers}
              disabled={syncing}
              variant="outline"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Senkronize Ediliyor...' : 'Tümünü Senkronize Et'}
            </Button>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz kullanıcı bulunamadı</h3>
            <p className="text-gray-500 mb-6">Exchange sunucusundan kullanıcıları senkronize edin</p>
            <Button onClick={handleSyncAllUsers} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Exchange&apos;den Kullanıcıları Çek
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onCheckedChange={toggleAllUsers}
                      />
                    </TableHead>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Son Senkronizasyon</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <div className="font-medium">{user.display_name}</div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.user_principal_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <div className="text-sm">{user.email}</div>
                          </div>
                          {user.job_title && (
                            <div className="text-sm text-muted-foreground">{user.job_title}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-400" />
                            <div className="text-sm">{user.department || '-'}</div>
                          </div>
                          {user.office_location && (
                            <div className="text-sm text-muted-foreground">{user.office_location}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {user.last_sync_date ? formatDate(user.last_sync_date) : 'Henüz senkronize edilmedi'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncUser(user.user_principal_name)}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Senkronize Et
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartBackup(user.id, user.user_principal_name)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Download className="mr-1 h-3 w-3" />
                            Yedekle
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Sayfa <span className="font-medium">{currentPage}</span> / <span className="font-medium">{totalPages}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Önceki
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Sonraki
                    <ChevronRight className="h-4 w-4" />
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