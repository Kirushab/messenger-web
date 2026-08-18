-- v336: stable device identity for Settings → Security → Devices.
-- A browser session is not the same thing as a physical device. The client now
-- keeps one random device_id per installation/browser profile and upserts one
-- row instead of inserting a new row on every sign-in.

ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS os_version text,
  ADD COLUMN IF NOT EXISTS is_pwa boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_sessions_user_device_key'
      AND conrelid = 'public.user_sessions'::regclass
  ) THEN
    ALTER TABLE public.user_sessions
      ADD CONSTRAINT user_sessions_user_device_key UNIQUE (user_id, device_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_last_active
  ON public.user_sessions (user_id, last_active DESC);

COMMENT ON COLUMN public.user_sessions.device_id IS
  'Random installation identifier stored locally. It identifies one browser/app installation, not an exact hardware serial number.';
