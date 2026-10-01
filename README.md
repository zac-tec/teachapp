# Teachapp

A personal learning journal for a guide and learner: daily class checklists, code and notes, topic assessments, revision, reflections, and projects.

**Stack:** React + Vite on Vercel, Cloudflare Worker API, Cloudflare D1, Google sign-in.

The repository contains code only. Learning records are stored in your private D1 database. Personal account emails and session secrets belong in Cloudflare secrets, never GitHub source. No ChatGPT subscription or API key is needed to run this app.

## Run locally

Requires Node.js 22.13+ (Node 24 recommended).

```sh
npm ci
cp .env.example .env.local
cp .dev.vars.example .dev.vars
# Fill .dev.vars with your Google client ID, invited accounts, and a random secret.
npm run db:local
npm run dev:api
```

In a second terminal run `npm run dev` and open `http://localhost:5173`. Configure that exact origin in your Google web client. There is deliberately no development authentication bypass.

## Deploy

Follow [the one-time setup](docs/SETUP.md). After setup:

- Push frontend changes to `main`: Vercel deploys automatically.
- Push backend or migration changes to `main`: GitHub Actions applies migrations and deploys the Worker.
- PRs run build and security checks without production credentials.
- Vercel preview URLs do not have permission to change production data; use the configured production URL for sign-in.

Cloudflare Free and Vercel Hobby are appropriate for a small personal/non-commercial app within their quotas. No paid plan or custom domain is required. This repository does not enable paid services automatically.

## Commands

| Command             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Frontend development server                              |
| `npm run dev:api`   | Local Worker and D1                                      |
| `npm run build`     | Type-check and build frontend                            |
| `npm test`          | Validation and authorization tests                       |
| `npm run db:local`  | Apply local migrations                                   |
| `npm run db:remote` | Apply production migrations after configuring your D1 ID |

## Project layout

- `src/`: interface and curriculum
- `worker/`: Google token verification, sessions, authorization, record API
- `migrations/`: append-only database schema changes
- `.github/workflows/`: checks and deployment
- `vercel.json`: frontend hosting and backend proxy

## Access

The guide can manage class records, topic assessments, projects and reflections. The learner can read the journal and update reflections and projects. Only the two configured verified Google accounts may sign in. The backend verifies token signatures, audience, issuer, expiry and a login nonce. Sessions are signed, HTTP-only cookies; mutations require an exact allowed origin. Changing an invited email revokes that email's existing sessions on the next request.

Code snippets are displayed as text, never executed. Entries use revision numbers to prevent silently overwriting newer edits. Neither GitHub nor Vercel stores learning records in the repository. Removing an old deployment is a separate action from deploying this one.
