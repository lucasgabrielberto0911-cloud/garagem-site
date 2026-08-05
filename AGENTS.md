# AGENTS.md

## Cursor Cloud specific instructions

### Product
Next.js 14 (App Router) dealership admin site (`garagem-site`) with Prisma + PostgreSQL, JWT cookie auth, and optional Supabase Storage for vehicle photo uploads.

### Required services
- **PostgreSQL** must be running before `npm run dev`, Prisma commands, or admin pages that hit the DB.
- **Next.js dev server**: `npm run dev` (port 3000).
- Supabase Storage is only required for `/api/upload` (photo uploads). Listing/creating vehicles with local placeholder paths (e.g. `/placeholder.png`) works without real Supabase credentials.

### Local env
Copy `.env.example` → `.env`. For local Postgres without Supabase pooler, set both `DATABASE_URL` and `DIRECT_URL` to the same connection string. `JWT_SECRET` is required (middleware throws if missing).

### Database
After Postgres is up and `.env` is set:
```bash
npx prisma db push
npm run db:seed
```
Seed admin: `admin@loja.com` / `troque-esta-senha`.

### Commands
- Lint: `npm run lint`
- Dev: `npm run dev`
- Build: `npm run build` (runs `prisma generate` then `next build`)
- Seed: `npm run db:seed`

### Gotchas
- Admin routes under `/admin/*` (except `/admin/login`) require a valid JWT `session` cookie; unauthenticated requests redirect to login.
- `.env` is gitignored — do not commit real Supabase/DB credentials.
- If Postgres was installed via apt in this environment, start it with `sudo pg_ctlcluster 16 main start` when the cluster is down.
