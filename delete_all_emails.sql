-- Exchange Mail Backup System - Tüm Emailleri Silme Komutu
-- Bu komut sistemdeki tüm emailleri ve ilgili verileri siler
-- Test amaçlı kullanım için hazırlanmıştır

-- 1. Önce email attachments tablosunu temizle (foreign key constraint nedeniyle)
DELETE FROM email_attachments;

-- 2. Emails tablosunu temizle
DELETE FROM emails;

-- 3. Mail folders tablosunu temizle (emails silindiği için artık boş)
DELETE FROM mail_folders;

-- 4. Backup jobs tablosunu temizle (eski backup kayıtları)
DELETE FROM backup_jobs;

-- 5. Kontrol için kalan kayıt sayılarını göster
SELECT 
    'email_attachments' as table_name, 
    COUNT(*) as remaining_records 
FROM email_attachments
UNION ALL
SELECT 
    'emails' as table_name, 
    COUNT(*) as remaining_records 
FROM emails
UNION ALL
SELECT 
    'mail_folders' as table_name, 
    COUNT(*) as remaining_records 
FROM mail_folders
UNION ALL
SELECT 
    'backup_jobs' as table_name, 
    COUNT(*) as remaining_records 
FROM backup_jobs;

-- Exchange users tablosu korunur (kullanıcı bilgileri silinmez)
-- Admin users tablosu korunur (sistem yöneticileri silinmez)