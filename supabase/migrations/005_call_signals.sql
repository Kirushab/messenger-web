-- Call signals table for reliable call signaling via Realtime postgres_changes
CREATE TABLE IF NOT EXISTS call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_call_signals_target ON call_signals(target_id);

-- Auto-delete signals older than 2 minutes
CREATE OR REPLACE FUNCTION cleanup_old_signals() RETURNS trigger AS $$
BEGIN
  DELETE FROM call_signals WHERE created_at < now() - interval '2 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_signals
  AFTER INSERT ON call_signals
  FOR EACH STATEMENT EXECUTE FUNCTION cleanup_old_signals();

-- RLS
ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert (send a signal)
CREATE POLICY "Users can send signals" ON call_signals
  FOR INSERT TO authenticated WITH CHECK (true);

-- Users can read their own signals
CREATE POLICY "Users can read own signals" ON call_signals
  FOR SELECT TO authenticated USING (target_id = auth.uid());

-- Users can delete their own signals
CREATE POLICY "Users can delete own signals" ON call_signals
  FOR DELETE TO authenticated USING (target_id = auth.uid());

-- Enable Realtime for call_signals
ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;
