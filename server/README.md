# Sky Cat global leaderboard (Cloudflare Worker + D1)

## Setup
```
cd sky-cat/server
npm install
npx wrangler d1 create sky_cat_lb
```
Copy the printed `database_id` into `wrangler.toml` (replace `REPLACE_AFTER_CREATE`).

## Apply schema
```
npx wrangler d1 execute sky_cat_lb --remote --file=schema.sql
```
Local testing: `npm run schema:local` then `npm run dev` (http://127.0.0.1:8787).

## Deploy
```
npx wrangler deploy
```
The worker URL is `https://sky-cat-leaderboard.<account-subdomain>.workers.dev`; it must match the `URL` constant in `src/net.js`.

## Endpoints
- `GET /` self-contained leaderboard page.
- `GET /api/top?mode=endless&limit=50&id=<playerId>`
  returns `{entries:[{rank,name,score,wave,skin,ts}], total, you:{rank,score}|null}`.
  Only mode `endless` exists (others are rejected with 400).
- `POST /api/submit` JSON `{id,name,mode,score,wave,kos,time,skin,v}` returns `{rank,total,best}`.
  Keeps the best score per (id, mode). Errors: JSON `{error}` with 400 or 429 (1 submit per 8 s per id).

All responses carry CORS `*`; OPTIONS preflight is answered.
