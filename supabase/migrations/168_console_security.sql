-- 168: Console users, registration approval, moderation and audit foundation.
-- Existing users stay approved. New public.users rows become pending by default.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

UPDATE public.users
SET approval_status = 'approved'
WHERE approval_status IS NULL;

ALTER TABLE public.users
  ALTER COLUMN approval_status SET DEFAULT 'pending',
  ALTER COLUMN approval_status SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_approval_status_check
    CHECK (approval_status IN ('pending','approved','rejected','blocked','deleted'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure every Auth account has a public profile. Existing accounts are approved so
-- this migration never unexpectedly locks out the current user base.
INSERT INTO public.users (id, email, display_name, approval_status)
SELECT
  au.id,
  COALESCE(NULLIF(au.email, ''), au.id::text || '@pending.local'),
  COALESCE(
    NULLIF(au.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(au.raw_user_meta_data ->> 'name', ''),
    NULLIF(split_part(COALESCE(au.email, ''), '@', 1), ''),
    'Пользователь'
  ),
  'approved'
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- New accounts created by the registration Edge Function receive a pending
-- public profile automatically. ON CONFLICT makes this safe alongside an older
-- dashboard trigger if one already exists.
CREATE OR REPLACE FUNCTION public.handle_sigmas_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.email, ''), NEW.id::text || '@pending.local'),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'Пользователь'
    ),
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = CASE
      WHEN NULLIF(public.users.display_name, '') IS NULL THEN EXCLUDED.display_name
      ELSE public.users.display_name
    END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_sigmas ON auth.users;
CREATE TRIGGER on_auth_user_created_sigmas
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_sigmas_auth_user_created();

CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','moderator','support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Bootstrap the project owner from either email used by the existing code/account.
INSERT INTO public.admin_roles (user_id, role)
SELECT id, 'owner'
FROM public.users
WHERE lower(email) IN ('lirikbog@gmail.com', 'lirikb2002@gmail.com')
ON CONFLICT (user_id) DO UPDATE SET role = 'owner';

CREATE OR REPLACE FUNCTION public.is_console_admin(check_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = check_uid
        AND ar.role IN ('owner','admin','moderator','support')
    )
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('lirikbog@gmail.com', 'lirikb2002@gmail.com');
$$;

CREATE OR REPLACE FUNCTION public.is_console_owner(check_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = check_uid AND ar.role = 'owner'
    )
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('lirikbog@gmail.com', 'lirikb2002@gmail.com');
$$;

REVOKE ALL ON FUNCTION public.is_console_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_console_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_console_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_console_owner(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  note text
);

CREATE INDEX IF NOT EXISTS idx_registration_requests_status
  ON public.registration_requests(status, created_at DESC);

-- Server-only rate-limit ledger used by registration-request. It stores hashes,
-- never the raw email or IP address.
CREATE TABLE IF NOT EXISTS public.registration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_email_created
  ON public.registration_attempts(email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_ip_created
  ON public.registration_attempts(ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_registration_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status = 'pending' THEN
    INSERT INTO public.registration_requests (user_id, email, display_name, status)
    VALUES (NEW.id, NEW.email, NEW.display_name, 'pending')
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      status = CASE
        WHEN public.registration_requests.status = 'approved' THEN public.registration_requests.status
        ELSE 'pending'
      END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_registration_request ON public.users;
CREATE TRIGGER trg_sync_registration_request
AFTER INSERT OR UPDATE OF approval_status, email, display_name ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_registration_request();

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created
  ON public.admin_audit_logs(created_at DESC);

-- Repair moderation table for projects where migration 167 was not applied.
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'other',
  details text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','resolved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS target_id uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON public.content_reports(status, created_at DESC);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_roles_select_console ON public.admin_roles;
CREATE POLICY admin_roles_select_console ON public.admin_roles
  FOR SELECT TO authenticated
  USING (public.is_console_admin());

DROP POLICY IF EXISTS registration_requests_select_own_or_admin ON public.registration_requests;
CREATE POLICY registration_requests_select_own_or_admin ON public.registration_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_console_admin());

DROP POLICY IF EXISTS registration_requests_insert_own ON public.registration_requests;
CREATE POLICY registration_requests_insert_own ON public.registration_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS registration_requests_update_admin ON public.registration_requests;
CREATE POLICY registration_requests_update_admin ON public.registration_requests
  FOR UPDATE TO authenticated
  USING (public.is_console_admin())
  WITH CHECK (public.is_console_admin());

DROP POLICY IF EXISTS admin_audit_logs_select_console ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_select_console ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_console_admin());

DROP POLICY IF EXISTS content_reports_select_console ON public.content_reports;
CREATE POLICY content_reports_select_console ON public.content_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_console_admin());

DROP POLICY IF EXISTS content_reports_update_console ON public.content_reports;
CREATE POLICY content_reports_update_console ON public.content_reports
  FOR UPDATE TO authenticated
  USING (public.is_console_admin())
  WITH CHECK (public.is_console_admin());

-- Keep the original reporter insert policy available even if migration 167 was skipped.
DROP POLICY IF EXISTS content_reports_insert_own ON public.content_reports;
CREATE POLICY content_reports_insert_own ON public.content_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
