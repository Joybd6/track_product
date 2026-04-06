# Scrap Component App

Modular Next.js application to:

- load a remote page in an embedded view
- pick a DOM element and generate a CSS selector
- define tracking logic (extract mode + condition)
- schedule recurring tracking jobs (cron)
- trigger modular actions when conditions are met
- configure per-job proxy settings
- create trackers with a guided step-by-step wizard
- manage all scheduled jobs in a dedicated dashboard page

## Quick Start

From this folder, run:

```bash
npm install
npm run prisma:migrate
npm run dev
```

Open http://localhost:3000.

## Heroku Deployment

This project is configured for Heroku with:

- `Procfile` for web + release process
- Postgres datasource (`DATABASE_URL`)
- single-dyno scheduler guard (`RUN_SCHEDULER_DYNO`)

### 1. Create app and add Postgres

```bash
heroku create <your-app-name>
heroku addons:create heroku-postgresql:essential-0
```

### 2. Set required config vars

```bash
heroku config:set AUTH_SECRET="<long-random-secret>"
heroku config:set INIT_ADMIN_EMAIL="admin@example.com"
heroku config:set INIT_ADMIN_PASSWORD="change-me-strong-password"
heroku config:set RUN_SCHEDULER_DYNO="web.1"
```

### 3. Deploy

```bash
git push heroku main
```

Release phase runs `npm run release` which applies schema via Prisma `db push`.

### 4. First run setup

After deploy, open your app:

- if database is empty, middleware redirects to `/install`
- run installation to create initial admin from env vars
- login and change password on first login

### 5. Scheduler note

Only dyno matching `RUN_SCHEDULER_DYNO` executes cron jobs.
This avoids duplicate alerts when scaling web dynos.

## Deployment: Initial Admin Credential

On first deployment, set these environment variables:

- `INIT_ADMIN_EMAIL`
- `INIT_ADMIN_PASSWORD`

Then run:

```bash
npm run prisma:generate
npm run admin:bootstrap
```

This command is idempotent:

- If the user does not exist, it creates an `ADMIN` user.
- If the user already exists, it promotes to `ADMIN` and updates password.

Recommended production flow:

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run admin:bootstrap
npm run build
npm run start
```

## Implemented Features

- Authentication and authorization:
	- registration/login (`/auth`)
	- role-based access (`USER`, `ADMIN`)
	- protected app/API routes with session cookie
- Step-by-step tracker wizard at `/`
	- Step 1: load page
	- Step 2: pick element
	- Step 3: define tracking rule
	- Step 4: configure actions + proxy
	- Step 5: schedule + create
- URL bar + embedded page (`/api/embed`) with click-to-select element picker
- Selector payload capture (`selector`, `text`, `tagName`, `attributes`)
- Job creation API (`/api/jobs`) and job control API (`/api/jobs/[id]`)
- Job run logging API (`/api/jobs/[id]/logs`)
- Comprehensive jobs dashboard at `/jobs` with:
	- search and filters
	- run/trigger counters
	- status and error visibility
	- run-now, enable/disable, and delete controls
	- user-friendly run result summaries
	- advanced mode to view raw run payloads
- Scheduler using `node-cron`
- Scraping/extraction using `cheerio`
- Condition operators:
	- `changed`
	- `contains`
	- `equals`
	- `greater_than`
	- `less_than`
- Action modules:
	- `console`
	- `webhook`
	- `email` (SMTP using `nodemailer`)
- Proxy-enabled fetch pipeline (HTTP/HTTPS proxies)
- Admin SMTP settings page (`/admin`) for global sender and mail transport

## Database

- ORM: Prisma
- DB: PostgreSQL (`DATABASE_URL`)
- Models:
	- `User`
	- `Job`
	- `JobAction`
	- `JobRunLog`
	- `AppConfig`

## Email Action Setup

Email alerts are sent to the logged-in user's registered email.
SMTP transport + sender email are configured by admin in `/admin`.

Email action can also fallback to environment variables.

Supported env vars:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

For in-stock alerts, use the "Apply In-Stock Alert Preset" button in Step 3 and enable Email action in Step 4.

## Modular Architecture

- `src/types/tracking.ts`: shared contracts for jobs, actions, conditions, proxy
- `src/lib/scrape/*`: fetch + extractor modules
- `src/lib/tracking/*`: condition + tracker run logic
- `src/lib/actions/*`: action registry and handlers
- `src/lib/scheduler/job-store.ts`: DB-backed scheduler + run logs
- `src/lib/db.ts`: Prisma client
- `src/lib/auth/*`: session/password/auth guards
- `src/lib/settings/admin-settings.ts`: global SMTP config storage
- `src/app/api/embed/route.ts`: embed/proxy page renderer with picker injection
- `src/app/api/jobs/*`: job CRUD/control/log endpoints
- `src/app/api/auth/*`: registration/login/logout/session endpoints
- `src/app/api/admin/settings/route.ts`: admin SMTP config endpoint
- `src/app/page.tsx`: step-by-step tracker wizard UI
- `src/app/jobs/page.tsx`: comprehensive jobs dashboard UI
- `src/app/auth/page.tsx`: login/register UI
- `src/app/admin/page.tsx`: admin SMTP settings UI

## Notes and Limitations

- Jobs and logs are persisted in SQLite.
- Cron scheduler requires a long-running Node.js process.
- Embedded pages are proxied through `/api/embed`; some sites may still break due to anti-bot/CSP/script behavior.
- Email action requires valid SMTP settings (admin-level or env-level fallback).

## Next Extension Points

- Add PostgreSQL deployment profile for production scale
- Add action plugins (email, Slack, SMS, custom script)
- Add tracker plugins (price parser, table diff, JSON-LD extraction)
- Add retries/backoff and job history logs
