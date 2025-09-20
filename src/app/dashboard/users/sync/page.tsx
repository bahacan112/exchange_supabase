'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'

interface SyncResult {
  total: number
  created: number
  updated: number
  errors: number
  errorDetails: string[]
}

interface ExchangeUser {
  id: string
  user_principal_name: string
  display_name: string
  email: string
  given_name: string
  surname: string
  job_title: string
  department: string
  office_location: string
  is_active: boolean
  last_sync: string
  created_at: string
  updated_at: string
}

export default function UserSyncPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth)
  const [loading, setLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [recentUsers, setRecentUsers] = useState<ExchangeUser[]>([])
  const [syncProgress, setSyncProgress] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    fetchRecentUsers()
  }, [isAuthenticated, router])

  const fetchRecentUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users?limit=10&orderBy=last_sync', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setRecentUsers(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch recent users:', error)
    }
  }

  const handleSyncAllUsers = async () => {
    if (!confirm('Tüm Exchange kullanıcılarını senkronize etmek istediğinizden emin misiniz? Bu işlem uzun sürebilir.')) {
      return
    }

    setLoading(true)
    setSyncResult(null)
    setSyncProgress(0)

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
        setSyncResult(result.data)
        setSyncProgress(100)
        await fetchRecentUsers()
      } else {
        const error = await response.json()
        alert(`Senkronizasyon hatası: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to sync users:', error)
      alert('Senkronizasyon sırasında hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncSingleUser = async (userPrincipalName: string) => {
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
        await fetchRecentUsers()
      } else {
        const error = await response.json()
        alert(`Senkronizasyon hatası: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to sync user:', error)
      alert('Senkronizasyon sırasında hata oluştu')
    }
  }

  const goBack = () => {
    router.push('/dashboard')
  }

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={goBack}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Geri
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Kullanıcı Senkronizasyonu
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user.username}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Sync Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Senkronizasyon İşlemleri
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Tüm Kullanıcıları Senkronize Et</h3>
                  <p className="text-sm text-gray-600">
                    Exchange'den tüm kullanıcıları çeker ve veritabanını günceller
                  </p>
                </div>
                <button
                  onClick={handleSyncAllUsers}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {loading ? 'Senkronize Ediliyor...' : 'Senkronize Et'}
                </button>
              </div>

              {loading && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>

          {/* Sync Results */}
          {syncResult && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Senkronizasyon Sonuçları
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{syncResult.total}</div>
                  <div className="text-sm text-blue-800">Toplam Kullanıcı</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{syncResult.created}</div>
                  <div className="text-sm text-green-800">Yeni Eklenen</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{syncResult.updated}</div>
                  <div className="text-sm text-yellow-800">Güncellenen</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{syncResult.errors}</div>
                  <div className="text-sm text-red-800">Hata</div>
                </div>
              </div>

              {syncResult.errorDetails.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium text-red-900 mb-2">Hatalar:</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {syncResult.errorDetails.map((error, index) => (
                      <li key={index} className="text-sm text-red-700">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Recent Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Son Senkronize Edilen Kullanıcılar
            </h2>
            
            {recentUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kullanıcı
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Departman
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
                    {recentUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.display_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.user_principal_name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.last_sync ? new Date(user.last_sync).toLocaleString('tr-TR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleSyncSingleUser(user.user_principal_name)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                          >
                            Tekrar Senkronize Et
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Henüz senkronize edilmiş kullanıcı bulunmuyor
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}