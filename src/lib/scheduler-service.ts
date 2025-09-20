import * as cron from 'node-cron'
import archiver from 'archiver'
import * as fs from 'fs'
import * as path from 'path'
import { BackupServiceInstance, BackupOptions } from './backup-service'
import { idriveClient } from './idrive-client'
import { supabase } from './supabase'

export interface ScheduledBackupConfig {
  id: string
  userId: string
  userPrincipalName: string
  cronExpression: string
  isActive: boolean
  backupType: 'incremental' | 'full'
  retentionDays: number
  includeAttachments: boolean
  maxEmailSize: number
  zipBackups: boolean
  lastRun?: Date
  nextRun?: Date
}

export class SchedulerService {
  private static instance: SchedulerService
  private scheduledTasks = new Map<string, cron.ScheduledTask>()
  private tempDir = path.join(process.cwd(), 'temp')

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService()
    }
    return SchedulerService.instance
  }

  constructor() {
    // Temp dizinini oluştur
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  async initializeScheduledBackups(): Promise<void> {
    try {
      console.log('Initializing scheduled backups...')

      // Sistem ayarlarından zamanlanmış yedekleme yapılandırmalarını çek
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'scheduled_backups')
        .single()

      if (settings?.value) {
        const configs: ScheduledBackupConfig[] = JSON.parse(settings.value)
        
        for (const config of configs) {
          if (config.isActive) {
            await this.scheduleBackup(config)
          }
        }

        console.log(`Initialized ${configs.filter(c => c.isActive).length} scheduled backups`)
      }

      // Günlük temizlik görevi (her gece 02:00'da)
      this.scheduleCleanupTask()

    } catch (error) {
      console.error('Failed to initialize scheduled backups:', error)
    }
  }

  async scheduleBackup(config: ScheduledBackupConfig): Promise<void> {
    try {
      // Mevcut görevi durdur
      if (this.scheduledTasks.has(config.id)) {
        this.scheduledTasks.get(config.id)?.stop()
        this.scheduledTasks.delete(config.id)
      }

      // Yeni görevi oluştur
      const task = cron.schedule(config.cronExpression, async () => {
        await this.executeScheduledBackup(config)
      }, {
        timezone: 'Europe/Istanbul'
      })

      // Görevi başlat
      task.start()
      this.scheduledTasks.set(config.id, task)

      console.log(`Scheduled backup for user ${config.userPrincipalName} with cron: ${config.cronExpression}`)

    } catch (error) {
      console.error(`Failed to schedule backup for ${config.userPrincipalName}:`, error)
    }
  }

  async executeScheduledBackup(config: ScheduledBackupConfig): Promise<void> {
    try {
      console.log(`Executing scheduled backup for user: ${config.userPrincipalName}`)

      // Son yedekleme tarihini belirle
      let startDate: Date
      if (config.backupType === 'incremental' && config.lastRun) {
        startDate = config.lastRun
      } else {
        // Full backup - son 24 saat
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      }

      const endDate = new Date()

      const backupOptions: BackupOptions = {
        userId: config.userId,
        userPrincipalName: config.userPrincipalName,
        startDate,
        endDate,
        includeAttachments: config.includeAttachments,
        maxEmailSize: config.maxEmailSize
      }

      // Yedekleme işini başlat
      const jobId = await BackupServiceInstance.startBackup(backupOptions)

      // Job tamamlanana kadar bekle (polling)
      await this.waitForJobCompletion(jobId)

      // ZIP oluştur (eğer etkinse)
      if (config.zipBackups) {
        await this.createDailyZip(config, startDate, endDate)
      }

      // Son çalışma zamanını güncelle
      await this.updateLastRunTime(config.id, endDate)

      // Eski yedeklemeleri temizle
      await this.cleanupOldBackups(config)

      console.log(`Scheduled backup completed for user: ${config.userPrincipalName}`)

    } catch (error) {
      console.error(`Scheduled backup failed for ${config.userPrincipalName}:`, error)
      
      // Hata bildirimini kaydet
      await this.logBackupError(config.id, error as Error)
    }
  }

  private async waitForJobCompletion(jobId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        try {
          const { data: job } = await supabase
            .from('backup_jobs')
            .select('status')
            .eq('id', jobId)
            .single()

          if (job?.status === 'completed') {
            clearInterval(checkInterval)
            resolve()
          } else if (job?.status === 'failed') {
            clearInterval(checkInterval)
            reject(new Error('Backup job failed'))
          }
        } catch (error) {
          clearInterval(checkInterval)
          reject(error)
        }
      }, 5000) // 5 saniyede bir kontrol et

      // 2 saat timeout
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('Backup job timeout'))
      }, 2 * 60 * 60 * 1000)
    })
  }

  private async createDailyZip(
    config: ScheduledBackupConfig,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      const dateStr = endDate.toISOString().split('T')[0]
      const zipFileName = `${config.userPrincipalName}_${dateStr}.zip`
      const zipPath = path.join(this.tempDir, zipFileName)

      // ZIP dosyası oluştur
      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      archive.pipe(output)

      // Yedeklenen emailları çek
      const { data: emails } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', config.userId)
        .gte('backup_date', startDate.toISOString())
        .lte('backup_date', endDate.toISOString())

      if (emails && emails.length > 0) {
        // Her email için EML dosyasını IDrive'dan indir ve ZIP'e ekle
        for (const email of emails) {
          try {
            if (email.backup_path) {
              const tempEmlPath = path.join(this.tempDir, `${email.message_id}.eml`)
              const emlContent = await idriveClient.downloadFile(email.backup_path, tempEmlPath)
              if (emlContent) {
                const fileName = `${email.message_id}.eml`
                const fileContent = fs.readFileSync(tempEmlPath)
                archive.append(fileContent, { name: fileName })
                fs.unlinkSync(tempEmlPath) // Temp dosyayı sil
              }
            }
          } catch (emailError) {
            console.error(`Failed to add email ${email.message_id} to ZIP:`, emailError)
          }
        }

        // Ekleri de ekle (eğer varsa)
        if (config.includeAttachments) {
          const { data: attachments } = await supabase
            .from('email_attachments')
            .select('*')
            .in('email_id', emails.map(e => e.id))

          if (attachments) {
            for (const attachment of attachments) {
              try {
                if (attachment.backup_path) {
                  const tempAttachmentPath = path.join(this.tempDir, `${attachment.id}_${attachment.filename}`)
                  const attachmentData = await idriveClient.downloadFile(attachment.backup_path, tempAttachmentPath)
                  if (attachmentData) {
                    const fileName = `attachments/${attachment.filename}`
                    const fileContent = fs.readFileSync(tempAttachmentPath)
                    archive.append(fileContent, { name: fileName })
                    fs.unlinkSync(tempAttachmentPath) // Temp dosyayı sil
                  }
                }
              } catch (attachmentError) {
                console.error(`Failed to add attachment ${attachment.filename} to ZIP:`, attachmentError)
              }
            }
          }
        }
      }

      // ZIP'i sonlandır
      await archive.finalize()

      // ZIP dosyasını IDrive'a yükle
      return new Promise((resolve, reject) => {
        output.on('close', async () => {
          try {
            const zipBuffer = fs.readFileSync(zipPath)
            const uploadPath = `exchange-backup/${config.userPrincipalName}/daily-zips/${dateStr}`
            
            await idriveClient.uploadFile(zipPath, `${uploadPath}/${zipFileName}`)

            // Temp dosyayı sil
            fs.unlinkSync(zipPath)

            console.log(`Daily ZIP created and uploaded: ${zipFileName}`)
            resolve()
          } catch (uploadError) {
            reject(uploadError)
          }
        })

        output.on('error', reject)
      })

    } catch (error) {
      console.error('Failed to create daily ZIP:', error)
      throw error
    }
  }

  private async updateLastRunTime(configId: string, runTime: Date): Promise<void> {
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'scheduled_backups')
        .single()

      if (settings?.value) {
        const configs: ScheduledBackupConfig[] = JSON.parse(settings.value)
        const configIndex = configs.findIndex(c => c.id === configId)
        
        if (configIndex !== -1) {
          configs[configIndex].lastRun = runTime
          
          await supabase
            .from('system_settings')
            .update({ 
              value: JSON.stringify(configs),
              updated_at: new Date().toISOString()
            })
            .eq('key', 'scheduled_backups')
        }
      }
    } catch (error) {
      console.error('Failed to update last run time:', error)
    }
  }

  private async cleanupOldBackups(config: ScheduledBackupConfig): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000)

      // Eski backup job'ları sil
      await supabase
        .from('backup_jobs')
        .delete()
        .eq('user_id', config.userId)
        .lt('created_at', cutoffDate.toISOString())

      // Eski email kayıtlarını sil (IDrive'dan da silinmeli)
      const { data: oldEmails } = await supabase
        .from('emails')
        .select('backup_path')
        .eq('user_id', config.userId)
        .lt('backup_date', cutoffDate.toISOString())

      if (oldEmails) {
        for (const email of oldEmails) {
          if (email.backup_path) {
            try {
              await idriveClient.deleteFile(email.backup_path)
            } catch (deleteError) {
              console.error(`Failed to delete old backup file: ${email.backup_path}`, deleteError)
            }
          }
        }

        // Veritabanından sil
        await supabase
          .from('emails')
          .delete()
          .eq('user_id', config.userId)
          .lt('backup_date', cutoffDate.toISOString())
      }

      console.log(`Cleaned up backups older than ${config.retentionDays} days for user ${config.userPrincipalName}`)

    } catch (error) {
      console.error('Failed to cleanup old backups:', error)
    }
  }

  private async logBackupError(configId: string, error: Error): Promise<void> {
    try {
      await supabase
        .from('system_settings')
        .upsert({
          key: `backup_error_${configId}`,
          value: JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString(),
            stack: error.stack
          }),
          updated_at: new Date().toISOString()
        })
    } catch (logError) {
      console.error('Failed to log backup error:', logError)
    }
  }

  private scheduleCleanupTask(): void {
    // Her gece 02:00'da temp dizinini temizle
    cron.schedule('0 2 * * *', () => {
      this.cleanupTempDirectory()
    }, {
      timezone: 'Europe/Istanbul'
    })
  }

  private cleanupTempDirectory(): void {
    try {
      const files = fs.readdirSync(this.tempDir)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        const stats = fs.statSync(filePath)
        
        if (stats.mtime.getTime() < oneDayAgo) {
          fs.unlinkSync(filePath)
          console.log(`Cleaned up temp file: ${file}`)
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp directory:', error)
    }
  }

  async addScheduledBackup(config: ScheduledBackupConfig): Promise<void> {
    try {
      // Mevcut yapılandırmaları çek
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'scheduled_backups')
        .single()

      let configs: ScheduledBackupConfig[] = []
      if (settings?.value) {
        configs = JSON.parse(settings.value)
      }

      // Yeni yapılandırmayı ekle
      configs.push(config)

      // Veritabanını güncelle
      await supabase
        .from('system_settings')
        .upsert({
          key: 'scheduled_backups',
          value: JSON.stringify(configs),
          updated_at: new Date().toISOString()
        })

      // Zamanlamayı başlat
      if (config.isActive) {
        await this.scheduleBackup(config)
      }

    } catch (error) {
      console.error('Failed to add scheduled backup:', error)
      throw error
    }
  }

  async removeScheduledBackup(configId: string): Promise<void> {
    try {
      // Görevi durdur
      if (this.scheduledTasks.has(configId)) {
        this.scheduledTasks.get(configId)?.stop()
        this.scheduledTasks.delete(configId)
      }

      // Yapılandırmayı kaldır
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'scheduled_backups')
        .single()

      if (settings?.value) {
        const configs: ScheduledBackupConfig[] = JSON.parse(settings.value)
        const filteredConfigs = configs.filter(c => c.id !== configId)

        await supabase
          .from('system_settings')
          .update({
            value: JSON.stringify(filteredConfigs),
            updated_at: new Date().toISOString()
          })
          .eq('key', 'scheduled_backups')
      }

    } catch (error) {
      console.error('Failed to remove scheduled backup:', error)
      throw error
    }
  }

  getScheduledTasks(): Map<string, cron.ScheduledTask> {
    return this.scheduledTasks
  }
}

export const SchedulerServiceInstance = SchedulerService.getInstance()