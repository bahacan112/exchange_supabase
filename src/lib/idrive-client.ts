import { S3Client, HeadBucketCommand, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'

export class IDriveClient {
  private s3Client: S3Client
  private bucketName: string
  private basePath: string

  constructor() {
    const accessKeyId = process.env.IDRIVE_E2_ACCESS_KEY_ID!
    const secretAccessKey = process.env.IDRIVE_E2_SECRET_ACCESS_KEY!
    const endpoint = `https://${process.env.IDRIVE_E2_ENDPOINT}` // örn: https://e4k3.fra.idrivee2-59.com
    this.bucketName = process.env.IDRIVE_E2_BUCKET!
    this.basePath = process.env.IDRIVE_BASE_PATH || 'exchange-backups'

    this.s3Client = new S3Client({
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      endpoint,
      region: 'us-east-1', // IDrive E2 genellikle us-east-1 kullanır
      forcePathStyle: true,
    })
  }

  async authenticate(): Promise<boolean> {
    try {
      // S3 client ile bucket'ın varlığını kontrol ederek authentication test et
      const command = new HeadBucketCommand({ Bucket: this.bucketName })
      await this.s3Client.send(command)
      return true
    } catch (error) {
      console.error('IDrive authentication failed:', error)
      return false
    }
  }

  async createFolder(folderPath: string): Promise<boolean> {
    try {
      // S3'te klasör oluşturmak için boş bir obje yükleriz (trailing slash ile)
      const key = `${this.basePath}/${folderPath}/`
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: '',
        ContentLength: 0
      })
      
      await this.s3Client.send(command)
      return true
    } catch (error) {
      console.error('Error creating folder:', error)
      return false
    }
  }

  async uploadFile(localFilePath: string, remotePath: string): Promise<boolean> {
    try {
      const fileStream = fs.createReadStream(localFilePath)
      const key = `${this.basePath}/${remotePath}`

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileStream
      })

      await this.s3Client.send(command)
      return true
    } catch (error) {
      console.error('Error uploading file:', error)
      return false
    }
  }

  async uploadBuffer(buffer: Buffer, remotePath: string, filename: string): Promise<boolean> {
    try {
      const key = `${this.basePath}/${remotePath}`

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: this.getContentType(filename)
      })

      await this.s3Client.send(command)
      return true
    } catch (error) {
      console.error('Error uploading buffer:', error)
      return false
    }
  }

  async downloadFile(remotePath: string, localPath: string): Promise<boolean> {
    try {
      const key = `${this.basePath}/${remotePath}`

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      })

      const response = await this.s3Client.send(command)

      if (response.Body) {
        const chunks: Uint8Array[] = []
        
        // AWS SDK v3 returns a stream that needs to be handled differently
        if (response.Body instanceof ReadableStream) {
          const reader = response.Body.getReader()
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }
        } else {
          // Handle Node.js Readable stream
          const stream = response.Body as any
          for await (const chunk of stream) {
            chunks.push(chunk)
          }
        }
        
        const buffer = Buffer.concat(chunks)
        fs.writeFileSync(localPath, buffer)
        return true
      }

      return false
    } catch (error) {
      console.error('Error downloading file:', error)
      return false
    }
  }

  async listFiles(folderPath: string): Promise<any[]> {
    try {
      const prefix = `${this.basePath}/${folderPath}/`

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      })

      const response = await this.s3Client.send(command)

      return response.Contents?.map(obj => ({
        name: obj.Key?.replace(prefix, ''),
        size: obj.Size,
        lastModified: obj.LastModified,
        key: obj.Key
      })) || []
    } catch (error) {
      console.error('Error listing files:', error)
      return []
    }
  }

  async deleteFile(remotePath: string): Promise<boolean> {
    try {
      const key = `${this.basePath}/${remotePath}`

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      })

      await this.s3Client.send(command)
      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      return false
    }
  }

  async getFileInfo(remotePath: string): Promise<any> {
    try {
      const key = `${this.basePath}/${remotePath}`

      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      })

      const response = await this.s3Client.send(command)

      return {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        etag: response.ETag
      }
    } catch (error) {
      console.error('Error getting file info:', error)
      return null
    }
  }

  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase()
    const contentTypes: { [key: string]: string } = {
      '.eml': 'message/rfc822',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.zip': 'application/zip'
    }
    return contentTypes[ext] || 'application/octet-stream'
  }

  // Helper methods for Exchange backup specific operations
  async createUserBackupFolder(userPrincipalName: string): Promise<string> {
    const userFolder = `${userPrincipalName}`
    await this.createFolder(userFolder)
    
    // Sadece ekler klasörü oluştur
    await this.createFolder(`${userFolder}/ekler`)
    
    return userFolder
  }

  private generateEmailFileName(sentDate: string, senderEmail: string, senderName?: string): string {
    try {
      // Tarihi formatla (YYYY-MM-DD_HH-mm-ss)
      const date = new Date(sentDate)
      const formattedDate = date.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..+/, '')

      // Gönderen bilgisini temizle
      const sender = senderName || senderEmail || 'unknown'
      const cleanSender = sender
        .replace(/[^a-zA-Z0-9\s.-]/g, '') // Özel karakterleri kaldır
        .replace(/\s+/g, '_') // Boşlukları alt çizgi yap
        .substring(0, 50) // Maksimum 50 karakter

      return `${formattedDate}_${cleanSender}.eml`
    } catch (error) {
      console.error('Error generating email filename:', error)
      // Fallback olarak timestamp kullan
      return `${Date.now()}_email.eml`
    }
  }

  async uploadEmailAsEml(
    userPrincipalName: string, 
    folderId: string, 
    messageId: string, 
    emlContent: string,
    sentDate?: string,
    senderEmail?: string,
    senderName?: string
  ): Promise<string> {
    // Yeni dosya ismi formatını kullan
    const fileName = sentDate && senderEmail 
      ? this.generateEmailFileName(sentDate, senderEmail, senderName)
      : `${messageId}.eml` // Fallback

    const remotePath = `${userPrincipalName}/emails/${folderId}/${fileName}`
    
    const buffer = Buffer.from(emlContent, 'utf-8')
    const success = await this.uploadBuffer(buffer, remotePath, fileName)
    
    return success ? remotePath : ''
  }

  async uploadAttachment(userPrincipalName: string, messageId: string, attachmentId: string, attachmentData: Buffer, filename: string): Promise<string> {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const remotePath = `${userPrincipalName}/ekler/${sanitizedFilename}-${attachmentId}`
    
    const success = await this.uploadBuffer(attachmentData, remotePath, `${sanitizedFilename}-${attachmentId}`)
    
    return success ? remotePath : ''
  }

  async uploadDailyBackupZip(userPrincipalName: string, date: string, zipFilePath: string): Promise<string> {
    const filename = `backup_${date}.zip`
    const remotePath = `${userPrincipalName}/daily-backups/${filename}`
    
    const success = await this.uploadFile(zipFilePath, remotePath)
    
    return success ? remotePath : ''
  }

  async getStorageUsage(): Promise<{ used: number; total: number }> {
    try {
      // S3'te storage usage bilgisi almak için bucket'taki tüm objeleri listeleriz
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.basePath
      })

      const response = await this.s3Client.send(command)

      const used = response.Contents?.reduce((total, obj) => total + (obj.Size || 0), 0) || 0
      
      return {
        used,
        total: 0 // S3'te total limit bilgisi genelde yoktur
      }
    } catch (error) {
      console.error('Error getting storage usage:', error)
      return { used: 0, total: 0 }
    }
  }
}

// Singleton instance
export const idriveClient = new IDriveClient()

// Export the class as default and named export
export default IDriveClient
export { IDriveClient as IDriveService }

// Helper functions
export async function ensureIDriveConnection(): Promise<boolean> {
  try {
    return await idriveClient.authenticate()
  } catch (error) {
    console.error('Failed to connect to IDrive:', error)
    return false
  }
}

export async function uploadEmailToIDrive(
  userPrincipalName: string,
  folderId: string,
  messageId: string,
  emlContent: string,
  sentDate?: string,
  senderEmail?: string,
  senderName?: string
): Promise<string> {
  try {
    return await idriveClient.uploadEmailAsEml(
      userPrincipalName, 
      folderId, 
      messageId, 
      emlContent,
      sentDate,
      senderEmail,
      senderName
    )
  } catch (error) {
    console.error('Failed to upload email to IDrive:', error)
    return ''
  }
}

export async function uploadAttachmentToIDrive(
  userPrincipalName: string,
  messageId: string,
  attachmentId: string,
  attachmentData: Buffer,
  filename: string
): Promise<string> {
  try {
    return await idriveClient.uploadAttachment(userPrincipalName, messageId, attachmentId, attachmentData, filename)
  } catch (error) {
    console.error('Failed to upload attachment to IDrive:', error)
    return ''
  }
}