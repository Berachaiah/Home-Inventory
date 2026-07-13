# Home Inventory — Frontend

Next.js (App Router) frontend for the Home Inventory backend.

## Setup
```
npm install
```

`.env.local` already points at `http://localhost:8000` — change `NEXT_PUBLIC_API_URL`
if your backend runs elsewhere (e.g. once deployed to Vercel, point it at your
deployed FastAPI URL).

## Run locally
```
npm run dev
```
Visit http://localhost:3000 — you'll be redirected to /login. Log in with a user
created via the backend's `/api/auth/register` endpoint (use `/docs` on the backend
to create your first admin user).

## Pages
- `/login` — sign in, stores JWT in localStorage
- `/` — item list with stock/expiry status (shelf-tick left border, colored by status)
- `/assistant` — chat with the AI assistant; any withdrawal/batch/restock-plan action
  it wants to take shows as a Confirm/Cancel prompt before it's executed

## PWA
`public/manifest.json` and `public/sw.js` are already wired up (service worker
registered in `app/layout.tsx`). See the chat response for the remaining steps
to make it fully installable (icons are placeholders — swap them for real artwork).
