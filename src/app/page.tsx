'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/lib/redux/store'

export default function HomePage() {
  const router = useRouter()
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth)

  useEffect(() => {
    // Kullanıcı giriş yapmışsa dashboard'a yönlendir
    if (isAuthenticated && user) {
      router.push('/dashboard')
    } else {
      // Giriş yapmamışsa login sayfasına yönlendir
      router.push('/login')
    }
  }, [isAuthenticated, user, router])

  // Yönlendirme sırasında loading göster
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Yönlendiriliyor...</p>
      </div>
    </div>
  )
}
