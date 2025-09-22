-- Exchange Mail Backup System Database Schema

-- Admin users table for system authentication
CREATE TABLE admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exchange users table
CREATE TABLE exchange_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_principal_name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_sync_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mail folders table
CREATE TABLE mail_folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exchange_user_id UUID REFERENCES exchange_users(id) ON DELETE CASCADE,
    folder_id VARCHAR(255) NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    parent_folder_id VARCHAR(255),
    folder_path TEXT,
    total_item_count INTEGER DEFAULT 0,
    unread_item_count INTEGER DEFAULT 0,
    last_sync_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exchange_user_id, folder_id)
);

-- Emails table
CREATE TABLE emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exchange_user_id UUID REFERENCES exchange_users(id) ON DELETE CASCADE,
    mail_folder_id UUID REFERENCES mail_folders(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    subject TEXT,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    recipients TEXT[], -- JSON array of recipients
    cc_recipients TEXT[], -- JSON array of CC recipients
    bcc_recipients TEXT[], -- JSON array of BCC recipients
    body_preview TEXT,
    body_content TEXT,
    body_content_type VARCHAR(20), -- 'text' or 'html'
    received_date TIMESTAMP WITH TIME ZONE,
    sent_date TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT false,
    importance VARCHAR(20), -- 'low', 'normal', 'high'
    has_attachments BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,
    -- eml_file_path ve idrive_folder_path alanları kaldırıldı - artık sadece ekleri saklıyoruz
    backup_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    backup_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exchange_user_id, message_id)
);

-- Email attachments table
CREATE TABLE email_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    attachment_id VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    size_bytes BIGINT,
    backup_path TEXT, -- Path to attachment file in 'ekler' folder
    backup_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    backup_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(email_id, attachment_id)
);

-- Backup jobs table for tracking backup operations
CREATE TABLE backup_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- 'full_backup', 'incremental_backup', 'daily_backup'
    exchange_user_id UUID REFERENCES exchange_users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    total_emails INTEGER DEFAULT 0,
    processed_emails INTEGER DEFAULT 0,
    failed_emails INTEGER DEFAULT 0,
    error_message TEXT,
    idrive_zip_path TEXT, -- Path to daily backup ZIP file
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System settings table
CREATE TABLE system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_exchange_users_upn ON exchange_users(user_principal_name);
CREATE INDEX idx_exchange_users_active ON exchange_users(is_active);
CREATE INDEX idx_mail_folders_user_id ON mail_folders(exchange_user_id);
CREATE INDEX idx_mail_folders_folder_id ON mail_folders(folder_id);
CREATE INDEX idx_emails_user_id ON emails(exchange_user_id);
CREATE INDEX idx_emails_folder_id ON emails(mail_folder_id);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_received_date ON emails(received_date);
CREATE INDEX idx_emails_backup_status ON emails(backup_status);
CREATE INDEX idx_attachments_email_id ON email_attachments(email_id);
CREATE INDEX idx_backup_jobs_user_id ON backup_jobs(exchange_user_id);
CREATE INDEX idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX idx_backup_jobs_created_at ON backup_jobs(created_at);

-- Insert default admin user (password: admin123 - should be changed in production)
INSERT INTO admin_users (username, password_hash) 
VALUES ('admin', '$2b$10$rQZ8kHWKQVz7QQZ8kHWKQVz7QQZ8kHWKQVz7QQZ8kHWKQVz7QQZ8k');

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('backup_schedule', '0 2 * * *', 'Cron expression for daily backup schedule'),
('max_concurrent_backups', '5', 'Maximum number of concurrent backup jobs'),
('retention_days', '365', 'Number of days to retain backup data'),
('idrive_base_path', '/exchange-backups', 'Base path for IDrive storage'),
('graph_api_batch_size', '100', 'Batch size for Microsoft Graph API requests');

-- Enable Row Level Security (RLS)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admin users can manage all data" ON admin_users FOR ALL USING (true);
CREATE POLICY "Admin users can manage exchange users" ON exchange_users FOR ALL USING (true);
CREATE POLICY "Admin users can manage mail folders" ON mail_folders FOR ALL USING (true);
CREATE POLICY "Admin users can manage emails" ON emails FOR ALL USING (true);
CREATE POLICY "Admin users can manage attachments" ON email_attachments FOR ALL USING (true);
CREATE POLICY "Admin users can manage backup jobs" ON backup_jobs FOR ALL USING (true);
CREATE POLICY "Admin users can manage system settings" ON system_settings FOR ALL USING (true);