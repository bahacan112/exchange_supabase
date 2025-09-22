import { NextRequest, NextResponse } from 'next/server'
import { SchedulerServiceInstance } from './src/lib/scheduler-service'

// Zamanlayıcı servisini başlat (sadece bir kez)
let schedulerInitialized = false

export function middleware(request: NextRequest) {
  // Zamanlayıcı servisini başlat (sadece ilk request'te)
  if (!schedulerInitialized) {
    schedulerInitialized = true
    SchedulerServiceInstance.initializeScheduledBackups().catch(error => {
      console.error('Failed to initialize scheduler service:', error)
    })
    console.log('Scheduler service initialization started')
  }
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/auth/login', '/api/auth/logout']
  
  // Static files and public assets
  const staticRoutes = ['/favicon.ico', '/_next', '/public']
  
  // Check if the current path is a static route
  if (staticRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }
  
  // Check if the current path is a public route
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Check for authentication token
  const token = request.cookies.get('auth-token')?.value || 
                request.headers.get('Authorization')?.replace('Bearer ', '')

  // Protected routes - everything except public routes requires authentication
  const isProtectedRoute = pathname.startsWith('/dashboard') || 
                          (pathname.startsWith('/api') && !publicRoutes.includes(pathname)) ||
                          pathname === '/'

  // If no token and trying to access protected route, redirect to login
  if (!token && isProtectedRoute) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // If user has token but tries to access login page, redirect to dashboard
  if (token && pathname === '/login') {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  // If user has token but tries to access root, redirect to dashboard
  if (token && pathname === '/') {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}