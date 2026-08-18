ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_iv text;

ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;
ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS encrypted_iv text;
