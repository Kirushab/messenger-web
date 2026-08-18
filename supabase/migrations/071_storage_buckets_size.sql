-- ============================================================
-- 071_storage_buckets_size.sql
-- RPC для подсчёта размера файлов в Supabase Storage по бакетам.
-- Только для admin email.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_storage_buckets_size();

CREATE OR REPLACE FUNCTION public.get_storage_buckets_size()
RETURNS TABLE (
  bucket_id    text,
  total_bytes  bigint,
  pretty_size  text,
  file_count   bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM public.users WHERE id = auth.uid();
  IF v_email IS NULL OR v_email != 'lirikb2002@gmail.com' THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT
    o.bucket_id::text,
    COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint AS total_bytes,
    pg_size_pretty(COALESCE(SUM((o.metadata->>'size')::bigint), 0))::text AS pretty_size,
    COUNT(*)::bigint AS file_count
  FROM storage.objects o
  GROUP BY o.bucket_id
  ORDER BY total_bytes DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_storage_buckets_size() TO authenticated;
