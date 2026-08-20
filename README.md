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
2. Run `supabase/migrations/202608200001_goom_cms.sql` in the Supabase SQL Editor. It creates the tables, row-level security policies, image buckets and starter content.
3. Copy `.env.example` to `.env.local` and set:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-key
   ```

4. Create the administrator manually in Supabase Authentication > Users. There is no public registration screen.
5. Disable open sign-ups in the Supabase Authentication settings and restart the development server.

The CMS manages events, services, gallery images and site-wide contact/social settings. Uploaded images are stored in Supabase Storage.
