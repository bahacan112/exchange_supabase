'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Clock, User, Calendar } from 'lucide-react'

export default function NewSchedulerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    userPrincipalName: '',
    cronExpression: '',
    backupType: 'full',
    retentionDays: 30,
    isActive: true
  })

  const cronPresets = [
    { label: 'Her gün 02:00', value: '0 2 * * *' },
    { label: 'Her gün 06:00', value: '0 6 * * *' },
    { label: 'Hafta içi 02:00', value: '0 2 * * 1-5' },
    { label: 'Hafta sonu 03:00', value: '0 3 * * 0,6' },
    { label: 'Her Pazartesi 01:00', value: '0 1 * * 1' },
    { label: 'Her 6 saatte bir', value: '0 */6 * * *' },
    { label: 'Her 12 saatte bir', value: '0 */12 * * *' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        alert('Zamanlanmış yedekleme başarıyla oluşturuldu!')
        router.push('/dashboard?tab=scheduler')
      } else {
        const error = await response.json()
        alert(`Hata: ${error.error || 'Bilinmeyen hata'}`)
      }
    } catch (error) {
      console.error('Failed to create scheduled backup:', error)
      alert('Zamanlanmış yedekleme oluşturulurken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleCronPresetChange = (value: string) => {
    setFormData({ ...formData, cronExpression: value })
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Geri</span>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yeni Zamanlanmış Yedekleme</h1>
          <p className="text-gray-600">Otomatik yedekleme zamanlaması oluşturun</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Yedekleme Ayarları</span>
          </CardTitle>
          <CardDescription>
            Kullanıcı için otomatik yedekleme zamanlaması yapılandırın
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Kullanıcı Principal Name */}
            <div className="space-y-2">
              <Label htmlFor="userPrincipalName" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Kullanıcı Principal Name</span>
              </Label>
              <Input
                id="userPrincipalName"
                type="email"
                placeholder="ornek@domain.com"
                value={formData.userPrincipalName}
                onChange={(e) => setFormData({ ...formData, userPrincipalName: e.target.value })}
                required
              />
              <p className="text-sm text-gray-500">
                Exchange kullanıcısının tam e-posta adresi
              </p>
            </div>

            {/* Zamanlama Ayarları */}
            <div className="space-y-4">
              <Label className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Zamanlama</span>
              </Label>
              
              {/* Hazır Şablonlar */}
              <div className="space-y-2">
                <Label htmlFor="cronPreset" className="text-sm">Hazır Şablonlar</Label>
                <Select onValueChange={handleCronPresetChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Bir şablon seçin (isteğe bağlı)" />
                  </SelectTrigger>
                  <SelectContent>
                    {cronPresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Manuel Cron Expression */}
              <div className="space-y-2">
                <Label htmlFor="cronExpression" className="text-sm">Cron İfadesi</Label>
                <Input
                  id="cronExpression"
                  placeholder="0 2 * * * (Her gün 02:00)"
                  value={formData.cronExpression}
                  onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500">
                  Format: dakika saat gün ay haftanın_günü (örn: 0 2 * * * = her gün 02:00)
                </p>
              </div>
            </div>

            {/* Yedekleme Türü */}
            <div className="space-y-2">
              <Label htmlFor="backupType">Yedekleme Türü</Label>
              <Select 
                value={formData.backupType} 
                onValueChange={(value: string) => setFormData({ ...formData, backupType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Tam Yedekleme</SelectItem>
                  <SelectItem value="incremental">Artımlı Yedekleme</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Saklama Süresi */}
            <div className="space-y-2">
              <Label htmlFor="retentionDays">Saklama Süresi (Gün)</Label>
              <Input
                id="retentionDays"
                type="number"
                min="1"
                max="365"
                value={formData.retentionDays}
                onChange={(e) => setFormData({ ...formData, retentionDays: parseInt(e.target.value) })}
                required
              />
              <p className="text-sm text-gray-500">
                Yedekleme dosyalarının kaç gün saklanacağını belirtin (1-365 gün)
              </p>
            </div>

            {/* Form Buttons */}
            <div className="flex space-x-4 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Oluşturuluyor...' : 'Zamanlanmış Yedekleme Oluştur'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                İptal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}