'use client'

import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter, usePathname } from 'next/navigation'
import { checkAuthStatus } from '@/lib/redux/slices/authSlice'
import { AppDispatch, RootState } from '@/lib/redux/store'
import { supabase } from '@/lib/supabase'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, loading } = useSelector((state: RootState) => state.auth)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // İlk olarak mevcut session'ı kontrol et
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Initial session check:', session?.user?.id)
        
        if (session?.access_token) {
          // Session varsa localStorage'a kaydet
          localStorage.setItem('token', session.access_token)
        }
        
        // Auth durumunu kontrol et
        dispatch(checkAuthStatus())
      } catch (error) {
        console.error('Initial auth check failed:', error)
        dispatch(checkAuthStatus())
      }
    }

    initializeAuth()

    // Supabase auth state değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id)
        
        if (event === 'INITIAL_SESSION') {
          // İlk session yüklendiğinde
          if (session?.access_token) {
            localStorage.setItem('token', session.access_token)
            dispatch(checkAuthStatus())
          } else {
            // Session yoksa localStorage'ı temizle
            localStorage.removeItem('token')
            dispatch(checkAuthStatus())
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Token yenilendiğinde veya giriş yapıldığında
          if (session?.access_token) {
            localStorage.setItem('token', session.access_token)
          }
          dispatch(checkAuthStatus())
        } else if (event === 'SIGNED_OUT') {
          // Çıkış yapıldığında localStorage'ı temizle
          localStorage.removeItem('token')
          dispatch(checkAuthStatus())
        }
      }
    )

    // Periyodik token kontrolü (her 5 dakikada bir)
    refreshIntervalRef.current = setInterval(() => {
      dispatch(checkAuthStatus())
    }, 5 * 60 * 1000) // 5 dakika

    return () => {
      subscription.unsubscribe()
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [dispatch])

  useEffect(() => {
    // Auth durumu değiştiğinde yönlendirme yap
    if (!loading) {
      if (!isAuthenticated && pathname !== '/login') {
        router.push('/login')
      } else if (isAuthenticated && pathname === '/login') {
        router.push('/dashboard')
      }
    }
  }, [isAuthenticated, loading, pathname, router])

  return <>{children}</>
}