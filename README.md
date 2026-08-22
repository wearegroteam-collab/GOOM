# GOOM Event Production

Responsive front-end for GOOM Event Production, an entertainment and event production company based in Niagara, Ontario.

## Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS
- Lucide icons
- Next Image

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production check

```bash
npm run build
npm run start
```

The project uses the standard Next.js build and is ready to import into Vercel.

## Current scope

The public experience is backed by Supabase when configured and keeps local fallback content while the migration is validated. Payments, embedded Showpass widgets and email delivery are not included; event ticket buttons use each event's external `ticket_url`.

## Admin CMS and Supabase

The private CMS is available at `/admin`. To activate it:

1. Create a Supabase project.
2. Run `supabase/migrations/202608200001_goom_cms.sql` in the Supabase SQL Editor. It creates the tables, row-level security policies, image buckets and starter content. If the first migration was already installed before administrator validation was added, also run `supabase/migrations/202608200002_admin_authorization.sql`.
   To enable Showpass embeds and promotional videos, then run `supabase/migrations/202608200003_event_media_showpass.sql`.
   To enable the optional information banner below each event hero, also run `supabase/migrations/202608210001_event_info_banner.sql`.
   Finally, run `supabase/migrations/202608210002_home_banners_hero_media_instagram.sql` to enable responsive home banners, Instagram embeds and the image/video hero selector.
3. Copy `.env.example` to `.env.local` and set:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   NEXT_PUBLIC_SITE_URL=https://goomevents.ca
   ```

   `NEXT_PUBLIC_SUPABASE_URL` must be the project base URL only. Do not append `/rest/v1`, `/auth/v1` or `/storage/v1`.

   Legacy Supabase projects may use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable key.

4. Create the administrator manually in Supabase Authentication > Users. There is no public registration screen.
5. Open `supabase/authorize-admin.sql`, replace `admin@example.com` with the exact account email, and run it in the SQL Editor. The final query must return one row with `active = true`.
6. Disable open sign-ups in the Supabase Authentication settings and restart the development server.

The CMS manages responsive home banners, events, services, gallery images and site-wide contact/social settings. Uploaded images are stored in Supabase Storage.

Event records can also store an official Showpass widget embed. Promotional videos—including normalized Instagram, YouTube and Vimeo links—are stored as ordered URL metadata in `event_videos`; remote video files are never copied into the database or converted to base64. This feature does not require additional environment variables.

## Vercel

Import the project as a Next.js application. In Project Settings > Environment Variables, add the same three values for Production and Preview, then redeploy. No service-role or secret Supabase key is required by this application and none should be exposed with a `NEXT_PUBLIC_` prefix.

After deployment, set the production domain as the Supabase Authentication Site URL. If preview deployments will be used to sign in, add the appropriate Vercel preview pattern to Supabase's allowed Redirect URLs. Password login itself does not use a callback route, but keeping the URL configuration accurate prevents future email or OAuth flows from redirecting to the wrong host.
