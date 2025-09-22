import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client with auto refresh enabled
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Session'ı localStorage'da sakla
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Token refresh için daha agresif ayarlar
    flowType: 'pkce'
  }
})

// Server-side Supabase client with service role key (only available on server)
export const supabaseAdmin = typeof window === 'undefined' 
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  : null as any

// Auth client for server-side operations
export const createServerClient = () => {
  if (typeof window !== 'undefined') {
    throw new Error('Server client can only be used on the server side')
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Type guard for server-side usage
export const isServer = () => typeof window === 'undefined'

// Database types
export interface Profile {
  id: string
  username: string
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}

export interface AdminUser {
  id: string
  username: string
  password_hash: string
  created_at: string
  updated_at: string
}

export interface ExchangeUser {
  id: string
  user_principal_name: string
  display_name?: string
  email?: string
  is_active: boolean
  last_sync_date?: string
  created_at: string
  updated_at: string
}

export interface MailFolder {
  id: string
  exchange_user_id: string
  folder_id: string
  folder_name: string
  parent_folder_id?: string
  folder_path?: string
  total_item_count: number
  unread_item_count: number
  last_sync_date?: string
  created_at: string
  updated_at: string
}

export interface Email {
  id: string
  exchange_user_id: string
  mail_folder_id?: string
  message_id: string
  subject: string
  sender_email: string
  sender_name?: string
  recipients: string[]
  cc_recipients?: string[]
  bcc_recipients?: string[]
  body_preview?: string
  body_content?: string
  body_content_type?: string
  received_date?: string
  sent_date?: string
  is_read: boolean
  importance?: string
  has_attachments: boolean
  attachment_count: number
  // eml_file_path ve idrive_folder_path alanları kaldırıldı
  backup_status: 'pending' | 'completed' | 'failed'
  backup_date?: string
  created_at: string
  updated_at: string
}

export interface EmailAttachment {
  id: string
  email_id: string
  attachment_id: string
  filename: string
  content_type?: string
  size_bytes?: number
  backup_path?: string // idrive_file_path yerine backup_path
  backup_status: 'pending' | 'completed' | 'failed'
  backup_date?: string
  created_at: string
  updated_at: string
}

export interface BackupJob {
  id: string
  job_type: 'full_backup' | 'incremental_backup' | 'daily_backup'
  exchange_user_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  start_date?: string
  end_date?: string
  total_emails: number
  processed_emails: number
  failed_emails: number
  error_message?: string
  idrive_zip_path?: string
  created_at: string
  updated_at: string
}

export interface SystemSetting {
  id: string
  setting_key: string
  setting_value?: string
  description?: string
  created_at: string
  updated_at: string
}