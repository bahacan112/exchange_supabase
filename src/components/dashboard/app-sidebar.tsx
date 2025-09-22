'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { logoutUser } from '@/store/slices/authSlice'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  BarChart3,
  Database,
  Clock,
  Users,
  LogOut,
  Server,
  Settings,
  Calendar,
  UserPlus,
} from "lucide-react"

const navigationItems = [
  {
    title: "Genel Bakış",
    url: "/dashboard/overview",
    icon: BarChart3,
  },
  {
    title: "Yedeklemeler",
    url: "/dashboard/backups",
    icon: Database,
  },
  {
    title: "Zamanlayıcı",
    url: "/dashboard/scheduler",
    icon: Clock,
  },
  {
    title: "Kullanıcılar",
    url: "/dashboard/users",
    icon: Users,
  },
  {
    title: "Ayarlar",
    url: "/dashboard/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)

  const handleLogout = () => {
    localStorage.removeItem('token')
    dispatch(logoutUser())
    router.push('/login')
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <Server className="h-6 w-6 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Exchange Backup</span>
            <span className="text-xs text-muted-foreground">Yönetim Sistemi</span>
          </div>
        </div>
        <SidebarTrigger className="ml-auto" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigasyon</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                  >
                    <a href={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="p-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <Badge variant="secondary" className="text-xs">
                Admin
              </Badge>
            </div>
          </div>
          <Separator className="my-2" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}