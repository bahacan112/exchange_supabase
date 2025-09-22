'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Server, Mail, Shield, Clock } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="h-8 w-8" />
          <h2 className="text-3xl font-bold tracking-tight">Ayarlar</h2>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Exchange Server Ayarları */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Exchange Server Ayarları
            </CardTitle>
            <CardDescription>
              Exchange Server bağlantı ayarlarını yapılandırın
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="server-url">Server URL</Label>
                <Input 
                  id="server-url" 
                  placeholder="https://exchange.company.com" 
                  defaultValue="https://exchange.company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-version">Exchange Version</Label>
                <Input 
                  id="server-version" 
                  placeholder="2019" 
                  defaultValue="2019"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin-username">Admin Kullanıcı Adı</Label>
                <Input 
                  id="admin-username" 
                  placeholder="admin@company.com" 
                  defaultValue="admin@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Admin Şifre</Label>
                <Input 
                  id="admin-password" 
                  type="password" 
                  placeholder="••••••••" 
                />
              </div>
            </div>
            <Button>Bağlantıyı Test Et</Button>
          </CardContent>
        </Card>

        {/* Yedekleme Ayarları */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Yedekleme Ayarları
            </CardTitle>
            <CardDescription>
              Otomatik yedekleme ve güvenlik ayarları
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Otomatik Yedekleme</Label>
                <p className="text-sm text-muted-foreground">
                  Günlük otomatik yedekleme işlemini etkinleştir
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>ZIP Sıkıştırma</Label>
                <p className="text-sm text-muted-foreground">
                  Yedekleme dosyalarını ZIP formatında sıkıştır
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="backup-path">Yedekleme Klasörü</Label>
              <Input 
                id="backup-path" 
                placeholder="C:\Backups\Exchange" 
                defaultValue="C:\Backups\Exchange"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention-days">Saklama Süresi (Gün)</Label>
              <Input 
                id="retention-days" 
                type="number" 
                placeholder="30" 
                defaultValue="30"
              />
            </div>
          </CardContent>
        </Card>

        {/* Zamanlayıcı Ayarları */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Zamanlayıcı Ayarları
            </CardTitle>
            <CardDescription>
              Otomatik görevler için zamanlama ayarları
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="backup-time">Günlük Yedekleme Saati</Label>
                <Input 
                  id="backup-time" 
                  type="time" 
                  defaultValue="02:00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-interval">Senkronizasyon Aralığı (Dakika)</Label>
                <Input 
                  id="sync-interval" 
                  type="number" 
                  placeholder="60" 
                  defaultValue="60"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Hafta Sonu Yedekleme</Label>
                <p className="text-sm text-muted-foreground">
                  Hafta sonları da yedekleme işlemi yap
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* E-posta Bildirimleri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              E-posta Bildirimleri
            </CardTitle>
            <CardDescription>
              Sistem durumu ve hata bildirimleri için e-posta ayarları
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>E-posta Bildirimleri</Label>
                <p className="text-sm text-muted-foreground">
                  Sistem olayları için e-posta bildirimleri gönder
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-server">SMTP Server</Label>
                <Input 
                  id="smtp-server" 
                  placeholder="smtp.company.com" 
                  defaultValue="smtp.company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">SMTP Port</Label>
                <Input 
                  id="smtp-port" 
                  type="number" 
                  placeholder="587" 
                  defaultValue="587"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notification-email">Bildirim E-posta Adresi</Label>
              <Input 
                id="notification-email" 
                type="email" 
                placeholder="admin@company.com" 
                defaultValue="admin@company.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Kaydet Butonu */}
        <div className="flex justify-end">
          <Button size="lg">
            Ayarları Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}