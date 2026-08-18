-- 173_encrypted_chat_access.sql
-- Hide unfinished protected-chat creation behind the Admin Console allowlist
-- and enforce the same permission at the database level.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS encrypted_chat_access BOOLEAN NOT NULL DEFAULT FALSE;

-- Keep the database owner check aligned with src/lib/admin.ts so both project
-- owner accounts can use the Access Console and existing admin-only controls.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND LOWER(email) IN ('lirikbog@gmail.com', 'lirikb2002@gmail.com')
  );
$$;

-- Only the project owner (Admin Console) or service_role may change this flag.
CREATE OR REPLACE FUNCTION public.protect_encrypted_chat_access_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NEW.encrypted_chat_access IS DISTINCT FROM OLD.encrypted_chat_access THEN
    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT public.is_admin()
    THEN
      RAISE EXCEPTION 'encrypted_chat_access can only be changed by an administrator';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_encrypted_chat_access_flag ON public.users;
CREATE TRIGGER trg_protect_encrypted_chat_access_flag
BEFORE UPDATE OF encrypted_chat_access ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_encrypted_chat_access_flag();

-- A user without the allowlist flag cannot create a new encrypted conversation
-- or turn an existing ordinary conversation into an encrypted one through API calls.
CREATE OR REPLACE FUNCTION public.enforce_encrypted_chat_creation_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_enabling BOOLEAN := FALSE;
BEGIN
  IF COALESCE(NEW.is_encrypted, FALSE) THEN
    IF TG_OP = 'INSERT' THEN
      v_enabling := TRUE;
    ELSE
      v_enabling := NOT COALESCE(OLD.is_encrypted, FALSE);
    END IF;
  END IF;

  IF v_enabling
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.users
       WHERE id = v_uid
         AND encrypted_chat_access = TRUE
     )
  THEN
    RAISE EXCEPTION 'protected chat access is not enabled for this account';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_encrypted_chat_creation_access ON public.conversations;
CREATE TRIGGER trg_enforce_encrypted_chat_creation_access
BEFORE INSERT OR UPDATE OF is_encrypted ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_encrypted_chat_creation_access();

NOTIFY pgrst, 'reload schema';
