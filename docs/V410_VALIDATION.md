# v410 validation

- Updated `src/components/LinkPreview.tsx` to allow Booking images and to force-refresh weak cached Booking previews.
- Updated `supabase/functions/link-preview/index.ts` with Booking-specific hotel-image extraction heuristics and weak-image filtering.
- No SQL migration added.
- Build/deploy validation still requires redeploy of the Supabase `link-preview` Edge Function in the target environment.
