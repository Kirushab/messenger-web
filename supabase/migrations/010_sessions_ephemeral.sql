-- Active sessions tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_info text,
  ip_address text,
  created_at timestamptz DEFAULT now(),
  last_active timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "sess_select" ON user_sessions FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sess_insert" ON user_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sess_delete" ON user_sessions FOR DELETE TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sess_update" ON user_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ephemeral messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at) WHERE expires_at IS NOT NULL;

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_messages() RETURNS trigger AS $$
BEGIN
  DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_expired ON messages;
CREATE TRIGGER trg_cleanup_expired AFTER INSERT ON messages FOR EACH STATEMENT EXECUTE FUNCTION cleanup_expired_messages();
