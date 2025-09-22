import { Client } from '@microsoft/microsoft-graph-client'
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client'
import { ConfidentialClientApplication } from '@azure/msal-node'

class GraphAuthProvider implements AuthenticationProvider {
  private clientApp: ConfidentialClientApplication

  constructor() {
    this.clientApp = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.AZURE_CLIENT_ID!,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID!}`
      }
    })
  }

  async getAccessToken(): Promise<string> {
    try {
      const clientCredentialRequest = {
        scopes: ['https://graph.microsoft.com/.default']
      }

      const response = await this.clientApp.acquireTokenByClientCredential(clientCredentialRequest)
      return response?.accessToken || ''
    } catch (error) {
      console.error('Error acquiring token:', error)
      throw error
    }
  }
}

// Create Graph client instance
const authProvider = new GraphAuthProvider()
export const graphClient = Client.initWithMiddleware({ authProvider })

// Graph API helper functions
export class GraphService {
  static async getUsers(top: number = 999) {
    try {
      const users = await graphClient
        .api('/users')
        .select('id,userPrincipalName,displayName,mail,accountEnabled,givenName,surname,jobTitle,department,officeLocation')
        .top(top)
        .get()
      
      return users.value || []
    } catch (error) {
      console.error('Error fetching users:', error)
      throw error
    }
  }

  static async getUserMailFolders(userId: string) {
    try {
      const folders = await graphClient
        .api(`/users/${userId}/mailFolders`)
        .select('id,displayName,parentFolderId,totalItemCount,unreadItemCount')
        .get()
      
      return folders.value || []
    } catch (error) {
      console.error('Error fetching mail folders:', error)
      throw error
    }
  }

  static async getMailFolderMessages(userId: string, folderId: string, top: number = 100) {
    try {
      const messages = await graphClient
        .api(`/users/${userId}/mailFolders/${folderId}/messages`)
        .select('id,subject,sender,toRecipients,ccRecipients,bccRecipients,bodyPreview,body,receivedDateTime,sentDateTime,isRead,importance,hasAttachments')
        .top(top)
        .orderby('receivedDateTime desc')
        .get()
      
      return messages.value || []
    } catch (error) {
      console.error('Error fetching messages:', error)
      throw error
    }
  }

  static async getMessageAttachments(userId: string, messageId: string) {
    try {
      const attachments = await graphClient
        .api(`/users/${userId}/messages/${messageId}/attachments`)
        .select('id,name,contentType,size')
        .get()
      
      return attachments.value || []
    } catch (error) {
      console.error('Error fetching attachments:', error)
      return []
    }
  }

  static async getMessageAsEml(userId: string, messageId: string): Promise<string> {
    try {
      const emlContent = await graphClient
        .api(`/users/${userId}/messages/${messageId}/$value`)
        .get()
      
      return emlContent
    } catch (error) {
      console.error('Error fetching EML content:', error)
      throw error
    }
  }

  static async getMessagesInDateRange(userId: string, folderId: string, startDate: Date, endDate: Date) {
    try {
      const startDateString = startDate.toISOString()
      const endDateString = endDate.toISOString()
      
      const messages = await graphClient
        .api(`/users/${userId}/mailFolders/${folderId}/messages`)
        .select('id,subject,sender,toRecipients,ccRecipients,bccRecipients,bodyPreview,body,receivedDateTime,sentDateTime,isRead,importance,hasAttachments')
        .filter(`receivedDateTime ge ${startDateString} and receivedDateTime le ${endDateString}`)
        .orderby('receivedDateTime desc')
        .get()
      
      return messages
    } catch (error) {
      console.error('Error fetching messages in date range:', error)
      throw error
    }
  }

  static async getAllUserMessages(userId: string, folderId: string) {
    const allMessages = []
    const batchSize = 999 // Maksimum değer kullan

    try {
      const response = await this.getMailFolderMessages(userId, folderId, batchSize)
      
      if (response.value && response.value.length > 0) {
        allMessages.push(...response.value)
      }
    } catch (error) {
      console.error('Error in batch fetch:', error)
    }

    return allMessages
  }

  // Alias methods for backward compatibility
  static async getMessages(userId: string, folderId: string, top: number = 100) {
    return this.getMailFolderMessages(userId, folderId, top)
  }

  static async getEmailEML(userId: string, messageId: string): Promise<string> {
    return this.getMessageAsEml(userId, messageId)
  }

  static async getAttachments(userId: string, messageId: string) {
    return this.getMessageAttachments(userId, messageId)
  }

  static async downloadAttachment(userId: string, messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      const attachment = await graphClient
        .api(`/users/${userId}/messages/${messageId}/attachments/${attachmentId}`)
        .get()
      
      if (attachment.contentBytes) {
        return Buffer.from(attachment.contentBytes, 'base64')
      }
      
      throw new Error('Attachment content not found')
    } catch (error) {
      console.error('Error downloading attachment:', error)
      throw error
    }
  }
}

// Types for Graph API responses
export interface GraphUser {
  id: string
  userPrincipalName: string
  displayName: string
  mail: string
  accountEnabled: boolean
}

export interface GraphMailFolder {
  id: string
  displayName: string
  parentFolderId?: string
  totalItemCount: number
  unreadItemCount: number
}

export interface GraphMessage {
  id: string
  subject: string
  sender: {
    emailAddress: {
      name: string
      address: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  ccRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  bccRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  bodyPreview: string
  body: {
    contentType: string
    content: string
  }
  receivedDateTime: string
  sentDateTime: string
  isRead: boolean
  importance: string
  hasAttachments: boolean
}

export interface GraphAttachment {
  id: string
  name: string
  contentType: string
  size: number
}