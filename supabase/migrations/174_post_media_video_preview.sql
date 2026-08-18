-- v405: dimensions + generated poster for post video previews.
ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  ADD COLUMN IF NOT EXISTS width INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER;

COMMENT ON COLUMN public.post_media.preview_url IS 'Poster/thumbnail URL for video media';
COMMENT ON COLUMN public.post_media.width IS 'Original media width in pixels';
COMMENT ON COLUMN public.post_media.height IS 'Original media height in pixels';
