# One-time personal-account setup

Use your own accounts throughout. Do not paste access tokens or session secrets into chat or commit them.

## 1. Cloudflare D1 and Worker

1. In Cloudflare, stay on Workers Free. Create a D1 database named `teachapp`.
2. Copy its database ID into `wrangler.jsonc` in place of the all-zero placeholder. This ID is an identifier, not a password. Alternatively keep it in the `CLOUDFLARE_DATABASE_ID` environment variable and run `node scripts/deploy-config.mjs` to generate an ignored config file.
3. Authorize Wrangler using `npx wrangler login` from your own terminal. Review the requested permissions.
4. Run `npm run db:remote` to apply the initial schema, then `npm run deploy:api`.
5. Copy the Worker URL that Cloudflare returns. Replace the placeholder destination in `vercel.json` with that exact URL, retaining `/api/:path*`.

## 2. Vercel

1. Use the personal Hobby account. Import `zac-tec/teachapp` from GitHub. If connecting the GitHub app, select only this repository.
2. Keep the root directory as the repository root. The Vite framework, `npm run build`, and `dist` output are already configured.
3. Optionally add `VITE_STUDENT_NAME` as a frontend environment variable for the display name.
4. Deploy. Copy the production HTTPS origin (no trailing slash).
5. Vercel's Git integration deploys each future `main` push. No Vercel API token is needed in the repository.

## 3. Google sign-in for the app

This is separate from using Google to log into Vercel or Cloudflare.

1. Under your personal Google Cloud account, create/select a project for this journal.
2. Configure Google Auth Platform branding and audience. Request only basic sign-in identity; no Gmail or Drive access.
3. Create an OAuth client of type **Web application**.
4. Add the Vercel production origin under **Authorized JavaScript origins**. Add `http://localhost:5173` for local development if needed.
5. This implementation uses the Google Identity Services button callback, not a redirect flow. It does not require a client secret or redirect URI.
6. If the Google project is in Testing, add both invited Google accounts as test users. Complete any required Google configuration before use.

## 4. Set private Worker values

In the Cloudflare Worker's Settings, add these as secrets. Or use `npx wrangler secret put NAME` (it prompts without placing the value in shell history).

| Name               | Value                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| `APP_ORIGIN`       | Exact Vercel production origin, e.g. `https://your-project.vercel.app`      |
| `GOOGLE_CLIENT_ID` | Google Web application client ID                                            |
| `OWNER_EMAIL`      | The guide's personal Google email                                           |
| `STUDENT_EMAIL`    | The learner's Google email                                                  |
| `SESSION_SECRET`   | Random secret, at least 32 characters; generate with `openssl rand -hex 32` |

The client ID is public by design. The account emails and session secret are not included in the frontend. Do not put secrets in any `VITE_` variable. Use the production origin, not a preview URL. Add or update authorized Google origins when changing the website address.

## 5. Automatic backend deployment

1. Create a Cloudflare API token limited to the intended account, with **Workers Scripts: Edit** and **D1: Edit** permissions. Review the account scope carefully. Do not use a global API key.
2. In GitHub repository **Settings > Secrets and variables > Actions**, add encrypted secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_DATABASE_ID`
3. Add a repository variable `DEPLOY_BACKEND` with the value `true`.
4. Run **Deploy Cloudflare backend** from the Actions tab once. Future backend changes on `main` trigger it automatically.

The workflow is disabled until that variable is enabled. It never runs production deployment for a pull request. Cloudflare secrets set on the Worker are preserved by deployments; do not copy them into source or workflows.

## 6. Confirm once

- Sign in as the guide, save a class, and reopen it.
- Sign in as the learner; check that reflections/projects can be edited, while class records and assessments cannot.
- Confirm an unrelated account cannot sign in.
- Confirm GitHub checks, the Vercel deployment, and the Worker workflow succeed after a change.

Free plans have limits. Stay on the free plans; do not enable upgrades or usage-based add-ons just to complete this setup. Backups are intentionally outside the initial setup.

References: [Vercel Git deployments](https://vercel.com/docs/deployments/git), [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Google client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
