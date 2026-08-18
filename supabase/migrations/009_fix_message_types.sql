-- Add 'location' and 'poll' to allowed message types
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'file', 'voice', 'system', 'location', 'poll'));
