-- ============================================================
-- 022_events.sql
-- События движок — основа (v38). Тусы и Путешествия используют один backend.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('party', 'trip')),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  location_name TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived', 'cancelled')),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,  -- для v39 интеграции с чатом
  spotify_playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,  -- для v40
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_type_status_idx ON public.events(type, status, start_at DESC);
CREATE INDEX IF NOT EXISTS events_creator_idx ON public.events(creator_id);
CREATE INDEX IF NOT EXISTS events_start_at_idx ON public.events(start_at DESC) WHERE status = 'active';

-- Участники события + RSVP
CREATE TABLE IF NOT EXISTS public.event_members (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rsvp TEXT CHECK (rsvp IN ('going', 'maybe', 'not_going')),
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_members_user_idx ON public.event_members(user_id);
CREATE INDEX IF NOT EXISTS event_members_rsvp_idx ON public.event_members(event_id, rsvp);

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

-- Все аутентифицированные видят активные события (открытая социальная сеть для друзей)
DROP POLICY IF EXISTS "Anyone can read events" ON public.events;
CREATE POLICY "Anyone can read events"
  ON public.events FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can create events" ON public.events;
CREATE POLICY "Authenticated can create events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creator can update event" ON public.events;
CREATE POLICY "Creator can update event"
  ON public.events FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creator can delete event" ON public.events;
CREATE POLICY "Creator can delete event"
  ON public.events FOR DELETE
  USING (auth.uid() = creator_id);

-- Members
DROP POLICY IF EXISTS "Anyone can read members" ON public.event_members;
CREATE POLICY "Anyone can read members"
  ON public.event_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "User can insert own membership" ON public.event_members;
CREATE POLICY "User can insert own membership"
  ON public.event_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    -- Создатель события может добавить любого
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "User can update own RSVP" ON public.event_members;
CREATE POLICY "User can update own RSVP"
  ON public.event_members FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User can delete own membership" ON public.event_members;
CREATE POLICY "User can delete own membership"
  ON public.event_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND creator_id = auth.uid())
  );

-- Триггеры updated_at
CREATE OR REPLACE FUNCTION public.events_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.events_set_updated_at();

CREATE OR REPLACE FUNCTION public.event_members_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS event_members_updated_at ON public.event_members;
CREATE TRIGGER event_members_updated_at BEFORE UPDATE ON public.event_members FOR EACH ROW EXECUTE FUNCTION public.event_members_set_updated_at();

-- Триггер: при создании события автор автоматически становится участником со статусом going
CREATE OR REPLACE FUNCTION public.event_creator_auto_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.event_members (event_id, user_id, rsvp, invited_by)
  VALUES (NEW.id, NEW.creator_id, 'going', NEW.creator_id)
  ON CONFLICT (event_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS event_creator_auto_member_trigger ON public.events;
CREATE TRIGGER event_creator_auto_member_trigger
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.event_creator_auto_member();

-- Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'events уже в публикации';
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_members;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'event_members уже в публикации';
  END;
END $$;
