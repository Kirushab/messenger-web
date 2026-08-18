-- 1. User bio/status text + last_seen update
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text DEFAULT '';

-- 2. Pinned message in conversation
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_message_id uuid REFERENCES messages(id);

-- 3. Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_reactions_msg ON message_reactions(message_id);
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_reactions" ON message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "add_reaction" ON message_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "del_reaction" ON message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- 4. Polls
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id),
  question text NOT NULL,
  is_anonymous boolean DEFAULT false,
  is_multiple boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text text NOT NULL,
  sort_order int DEFAULT 0
);
CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, option_id, user_id)
);
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_polls" ON polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "create_poll" ON polls FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "read_opts" ON poll_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "create_opts" ON poll_options FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read_votes" ON poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "add_vote" ON poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "del_vote" ON poll_votes FOR DELETE TO authenticated USING (user_id = auth.uid());
