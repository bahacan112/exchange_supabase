'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/lib/redux/store'

interface ExchangeUser {
  id: string
  user_principal_name: string
  display_name?: string
  email?: string
  is_active: boolean
}

export default function NewBackupPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [users, setUsers] = useState<ExchangeUser[]>([])
  const [formData, setFormData] = useState({
    userId: '',
    startDate: '',
    endDate: '',
    includeAttachments: true,
    maxEmailSize: 25,
    includeFolders: [] as string[],
    excludeFolders: [] as string[]
  })
  const [firstEmailDate, setFirstEmailDate] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    fetchUsers()
  }, [isAuthenticated, router])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.data || []) // API'den gelen response formatına uygun olarak 'data' field'ını kullan
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFirstEmailDate = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/first-email-date?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setFirstEmailDate(data.firstEmailDate)
      }
    } catch (error) {
      console.error('İlk mail tarihi alınırken hata:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.userId) {
      alert('Lütfen bir kullanıcı seçin')
      return
    }

    setSubmitting(true)

    try {
      const selectedUser = users.find(u => u.id === formData.userId)
      const token = localStorage.getItem('token')
      
      // Başlangıç tarihi boşsa, kullanıcının ilk mail tarihini kullan
      let startDateToUse = formData.startDate
      if (!startDateToUse && firstEmailDate) {
        startDateToUse = firstEmailDate.split('T')[0] // ISO string'den sadece tarih kısmını al
      }
      
      const response = await fetch('/api/backup/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: formData.userId,
          userPrincipalName: selectedUser?.user_principal_name,
          startDate: startDateToUse ? new Date(startDateToUse).toISOString() : undefined,
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : new Date().toISOString(),
          includeAttachments: formData.includeAttachments,
          maxEmailSize: formData.maxEmailSize * 1024 * 1024, // MB to bytes
          includeFolders: formData.includeFolders.length > 0 ? formData.includeFolders : undefined,
          excludeFolders: formData.excludeFolders.length > 0 ? formData.excludeFolders : undefined
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert('Yedekleme başarıyla başlatıldı!')
        router.push(`/backup/${result.jobId}`)
      } else {
        const error = await response.json()
        alert(`Hata: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to start backup:', error)
      alert('Yedekleme başlatılırken hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Geri Dön
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Yeni Yedekleme Başlat</h1>
          <p className="mt-2 text-gray-600">
            Exchange kullanıcısı için yeni bir yedekleme işi oluşturun
          </p>
        </div>

        {/* Form */}
        <div className="bg-white shadow rounded-lg">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Kullanıcı Seçimi */}
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                Kullanıcı Seçin *
              </label>
              <select
                id="userId"
                value={formData.userId}
                onChange={(e) => {
                  const newUserId = e.target.value
                  setFormData({ ...formData, userId: newUserId })
                  if (newUserId) {
                    fetchFirstEmailDate(newUserId)
                  } else {
                    setFirstEmailDate(null)
                  }
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="">Kullanıcı seçin...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.user_principal_name} ({user.email || user.user_principal_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Tarih Aralığı */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Boş bırakırsanız: Kullanıcının daha önce yedeklenmiş maili varsa son yedeklenen mailden sonra, yoksa {firstEmailDate ? 'ilk mail tarihinden' : 'otomatik olarak'} başlar
                  {firstEmailDate && (
                    <span className="block text-blue-600">
                      İlk mail tarihi: {new Date(firstEmailDate).toLocaleDateString('tr-TR')}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">Boş bırakırsanız bugün</p>
              </div>
            </div>

            {/* Yedekleme Seçenekleri */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Yedekleme Seçenekleri</h3>
              
              <div className="flex items-center">
                <input
                  id="includeAttachments"
                  type="checkbox"
                  checked={formData.includeAttachments}
                  onChange={(e) => setFormData({ ...formData, includeAttachments: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="includeAttachments" className="ml-2 block text-sm text-gray-900">
                  Ekleri dahil et
                </label>
              </div>

              <div>
                <label htmlFor="maxEmailSize" className="block text-sm font-medium text-gray-700">
                  Maksimum E-posta Boyutu (MB)
                </label>
                <input
                  type="number"
                  id="maxEmailSize"
                  min="1"
                  max="100"
                  value={formData.maxEmailSize}
                  onChange={(e) => setFormData({ ...formData, maxEmailSize: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {submitting ? 'Başlatılıyor...' : 'Yedeklemeyi Başlat'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}