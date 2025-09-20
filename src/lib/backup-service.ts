import { GraphService } from './graph-client'
import { idriveClient } from './idrive-client'
import { supabase } from './supabase'
import { BackupJob, Email, EmailAttachment, MailFolder } from './supabase'

export interface BackupOptions {
  userId: string
  userPrincipalName: string
  startDate?: Date
  endDate?: Date
  includeFolders?: string[]
  excludeFolders?: string[]
  includeAttachments?: boolean
  maxEmailSize?: number // MB cinsinden
}

export interface BackupProgress {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  currentFolder?: string
  processedEmails: number
  totalEmails: number
  processedSize: number // bytes
  errors: string[]
}

export class BackupService {
  private static instance: BackupService
  private activeJobs = new Map<string, BackupProgress>()

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService()
    }
    return BackupService.instance
  }

  async startBackup(options: BackupOptions): Promise<string> {
    // Yedekleme işi oluştur
    const { data: backupJob, error } = await supabase
      .from('backup_jobs')
      .insert({
        exchange_user_id: options.userId,
        status: 'pending',
        job_type: 'full_backup',
        start_date: options.startDate?.toISOString(),
        end_date: options.endDate?.toISOString() || new Date().toISOString()
      })
      .select()
      .single()

    if (error || !backupJob) {
      throw new Error('Yedekleme işi oluşturulamadı: ' + error?.message)
    }

    // Progress tracking başlat
    const progress: BackupProgress = {
      jobId: backupJob.id,
      status: 'pending',
      progress: 0,
      processedEmails: 0,
      totalEmails: 0,
      processedSize: 0,
      errors: []
    }

    this.activeJobs.set(backupJob.id, progress)

    // Async olarak yedekleme işlemini başlat
    this.performBackup(backupJob.id, options).catch(error => {
      console.error('Backup failed:', error)
      this.updateJobStatus(backupJob.id, 'failed', error.message)
    })

    return backupJob.id
  }

  private async performBackup(jobId: string, options: BackupOptions): Promise<void> {
    const progress = this.activeJobs.get(jobId)
    if (!progress) return

    try {
      // Job durumunu güncelle
      await this.updateJobStatus(jobId, 'running')
      progress.status = 'running'

      // Kullanıcının mail klasörlerini çek
      const folders = await GraphService.getUserMailFolders(options.userPrincipalName)
      
      // Klasörleri filtrele
      const foldersToBackup = this.filterFolders(folders, options)
      
      // Toplam email sayısını hesapla
      let totalEmails = 0
      for (const folder of foldersToBackup) {
        const messages = await GraphService.getMessages(
          options.userPrincipalName,
          folder.id
        )
        totalEmails += messages.length
      }

      progress.totalEmails = totalEmails

      // Her klasör için yedekleme yap
      for (const folder of foldersToBackup) {
        progress.currentFolder = folder.displayName
        await this.backupFolder(jobId, options, folder, progress)
      }

      // Yedekleme tamamlandı
      await this.updateJobStatus(jobId, 'completed')
      progress.status = 'completed'
      progress.progress = 100

    } catch (error) {
      console.error('Backup error:', error)
      await this.updateJobStatus(jobId, 'failed', (error as Error).message)
      progress.status = 'failed'
      progress.errors.push((error as Error).message)
    }
  }

  private async backupFolder(
    jobId: string,
    options: BackupOptions,
    folder: any,
    progress: BackupProgress
  ): Promise<void> {
    try {
      // Klasörü veritabanına kaydet
      const { data: dbFolder } = await supabase
        .from('mail_folders')
        .upsert({
          user_id: options.userId,
          folder_id: folder.id,
          display_name: folder.displayName,
          parent_folder_id: folder.parentFolderId,
          child_folder_count: folder.childFolderCount || 0,
          unread_item_count: folder.unreadItemCount || 0,
          total_item_count: folder.totalItemCount || 0,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      // Klasördeki mesajları çek
      const messages = await GraphService.getMessages(
        options.userPrincipalName,
        folder.id
      )

      // Her mesaj için yedekleme yap
      for (const message of messages) {
        try {
          await this.backupEmail(jobId, options, message, dbFolder?.id, progress)
          progress.processedEmails++
          progress.progress = Math.round((progress.processedEmails / progress.totalEmails) * 100)
        } catch (emailError) {
          console.error(`Email backup error for ${message.id}:`, emailError)
          progress.errors.push(`Email ${message.id}: ${(emailError as Error).message}`)
        }
      }

    } catch (error) {
      console.error(`Folder backup error for ${folder.displayName}:`, error)
      progress.errors.push(`Folder ${folder.displayName}: ${(error as Error).message}`)
    }
  }

  private async backupEmail(
    jobId: string,
    options: BackupOptions,
    message: any,
    folderId: string | undefined,
    progress: BackupProgress
  ): Promise<void> {
    try {
      // Duplicate kontrolü - bu mail daha önce kaydedilmiş mi?
      const { data: existingEmail } = await supabase
        .from('emails')
        .select('id')
        .eq('message_id', message.id)
        .eq('exchange_user_id', options.userId)
        .single()

      if (existingEmail) {
        // Mail zaten var, atla
        console.log(`Email ${message.id} already exists, skipping...`)
        return
      }

      // EML içeriğini çek
      const emlContent = await GraphService.getEmailEML(options.userPrincipalName, message.id)
      
      if (!emlContent) {
        throw new Error('EML içeriği alınamadı')
      }

      // Email boyutunu kontrol et
      const emailSizeMB = Buffer.byteLength(emlContent, 'utf8') / (1024 * 1024)
      if (options.maxEmailSize && emailSizeMB > options.maxEmailSize) {
        throw new Error(`Email boyutu çok büyük: ${emailSizeMB.toFixed(2)}MB`)
      }

      // IDrive'a yükle - yeni dosya ismi formatı ile
      const uploadResult = await idriveClient.uploadEmailAsEml(
        options.userPrincipalName,
        folderId || 'inbox',
        message.id,
        emlContent,
        message.sentDateTime || message.receivedDateTime, // Gönderilme tarihi
        message.from?.emailAddress?.address, // Gönderen email
        message.from?.emailAddress?.name // Gönderen ismi
      )

      // Veritabanına kaydet
      const { data: dbEmail, error: insertError } = await supabase
        .from('emails')
        .insert({
          exchange_user_id: options.userId,
          mail_folder_id: folderId,
          message_id: message.id,
          subject: message.subject || '',
          sender_email: message.from?.emailAddress?.address || '',
          sender_name: message.from?.emailAddress?.name || '',
          recipients: message.toRecipients?.map((r: any) => r.emailAddress?.address) || [],
          cc_recipients: message.ccRecipients?.map((r: any) => r.emailAddress?.address) || [],
          bcc_recipients: message.bccRecipients?.map((r: any) => r.emailAddress?.address) || [],
          body_preview: message.bodyPreview || '',
          body_content: message.body?.content || '',
          body_content_type: message.body?.contentType || 'text',
          received_date: message.receivedDateTime,
          sent_date: message.sentDateTime,
          is_read: message.isRead || false,
          importance: message.importance || 'normal',
          has_attachments: message.hasAttachments || false,
          attachment_count: message.attachments?.length || 0,
          eml_file_path: uploadResult,
          idrive_folder_path: folderPath,
          backup_status: 'completed',
          backup_date: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('Database insert error:', insertError)
        throw new Error(`Veritabanına kayıt hatası: ${insertError.message}`)
      }

      console.log(`Email ${message.id} successfully saved to database and IDrive`)
      progress.processedSize += Buffer.byteLength(emlContent, 'utf8')

      // Ekleri yedekle
      if (options.includeAttachments && message.hasAttachments && dbEmail) {
        await this.backupAttachments(options.userPrincipalName, message.id, dbEmail.id)
      }

    } catch (error) {
      throw new Error(`Email yedekleme hatası: ${(error as Error).message}`)
    }
  }

  private async backupAttachments(
    userPrincipalName: string,
    messageId: string,
    emailId: string
  ): Promise<void> {
    try {
      const attachments = await GraphService.getAttachments(userPrincipalName, messageId)

      for (const attachment of attachments) {
        try {
          if (attachment.size > 25 * 1024 * 1024) { // 25MB limit
            console.warn(`Attachment too large: ${attachment.name} (${attachment.size} bytes)`)
            continue
          }

          // Ek dosyasını indir
          const attachmentData = await GraphService.downloadAttachment(
            userPrincipalName,
            messageId,
            attachment.id
          )

          if (!attachmentData) continue

          // IDrive'a yükle
          const fileName = `${attachment.id}_${attachment.name}`
          const folderPath = `exchange-backup/${userPrincipalName}/attachments/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`
          
          const uploadResult = await idriveClient.uploadAttachment(
            userPrincipalName,
            messageId,
            attachment.id,
            attachmentData,
            attachment.name
          )

          // Veritabanına kaydet
          await supabase
            .from('email_attachments')
            .upsert({
              attachment_id: attachment.id,
              email_id: emailId,
              filename: attachment.name,
              content_type: attachment.contentType || 'application/octet-stream',
              size: attachment.size,
              backup_path: uploadResult,
              backup_date: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

        } catch (attachmentError) {
          console.error(`Attachment backup error for ${attachment.name}:`, attachmentError)
        }
      }

    } catch (error) {
      console.error('Attachments backup error:', error)
    }
  }

  private filterFolders(folders: any[], options: BackupOptions): any[] {
    return folders.filter(folder => {
      // Include filtresi
      if (options.includeFolders && options.includeFolders.length > 0) {
        return options.includeFolders.some(include => 
          folder.displayName.toLowerCase().includes(include.toLowerCase())
        )
      }

      // Exclude filtresi
      if (options.excludeFolders && options.excludeFolders.length > 0) {
        return !options.excludeFolders.some(exclude => 
          folder.displayName.toLowerCase().includes(exclude.toLowerCase())
        )
      }

      return true
    })
  }

  private async updateJobStatus(
    jobId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    if (errorMessage) {
      updateData.error_message = errorMessage
    }

    await supabase
      .from('backup_jobs')
      .update(updateData)
      .eq('id', jobId)
  }

  getJobProgress(jobId: string): BackupProgress | null {
    return this.activeJobs.get(jobId) || null
  }

  getAllActiveJobs(): BackupProgress[] {
    return Array.from(this.activeJobs.values())
  }
}

export const BackupServiceInstance = BackupService.getInstance()