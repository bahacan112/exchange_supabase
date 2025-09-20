'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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
        alert(`Senkronizasyon tamamlandı. ${result.data.created} yeni kullanıcı eklendi, ${result.data.updated} kullanıcı güncellendi.`)
        fetchUsers()
      } else {
        const error = await response.json()
        alert(`Senkronizasyon hatası: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to sync users:', error)
      alert('Senkronizasyon sırasında hata oluştu')
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
        alert('Kullanıcı başarıyla senkronize edildi')
        fetchUsers()
      } else {
        const error = await response.json()
        alert(`Senkronizasyon hatası: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to sync user:', error)
      alert('Senkronizasyon sırasında hata oluştu')
    }
  }

  const handleStartBackup = async (userId: string, userPrincipalName: string) => {
    const startDate = prompt('Başlangıç tarihi (YYYY-MM-DD formatında, boş bırakırsanız otomatik belirlenir):')
    let parsedStartDate: Date | undefined
    
    if (startDate) {
      parsedStartDate = new Date(startDate)
      if (isNaN(parsedStartDate.getTime())) {
        alert('Geçersiz tarih formatı')
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
        alert('Yedekleme başlatıldı')
        router.push(`/dashboard/backup/progress/${result.data.jobId}`)
      } else {
        const error = await response.json()
        alert(`Yedekleme hatası: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to start backup:', error)
      alert('Yedekleme başlatılırken hata oluştu')
    }
  }

  const handleBulkBackup = async () => {
    if (selectedUsers.length === 0) {
      alert('Lütfen en az bir kullanıcı seçin')
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

    alert('Toplu yedekleme işleri başlatıldı')
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
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        {/* Arama ve İşlemler */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex-1 max-w-lg">
            <input
              type="text"
              placeholder="Kullanıcı ara..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div className="flex space-x-2">
            {selectedUsers.length > 0 && (
              <button
                onClick={handleBulkBackup}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Seçilenleri Yedekle ({selectedUsers.length})
              </button>
            )}
            <button
              onClick={handleSyncAllUsers}
              disabled={syncing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {syncing ? 'Senkronize Ediliyor...' : 'Tümünü Senkronize Et'}
            </button>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Kullanıcı bulunamadı.</p>
            <button
              onClick={handleSyncAllUsers}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Exchange&apos;den Kullanıcıları Çek
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onChange={toggleAllUsers}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kullanıcı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      E-posta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Departman
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Son Senkronizasyon
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.display_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.user_principal_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                        {user.job_title && (
                          <div className="text-sm text-gray-500">{user.job_title}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.department || '-'}</div>
                        {user.office_location && (
                          <div className="text-sm text-gray-500">{user.office_location}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_sync_date ? formatDate(user.last_sync_date) : 'Henüz senkronize edilmedi'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSyncUser(user.user_principal_name)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Senkronize Et
                          </button>
                          <button
                            onClick={() => handleStartBackup(user.id, user.user_principal_name)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Yedekle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Önceki
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Sonraki
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Sayfa <span className="font-medium">{currentPage}</span> / <span className="font-medium">{totalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        →
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}