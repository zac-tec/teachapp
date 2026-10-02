# GitHub workspace setup

The journal, practice and LeetCode pages work without GitHub. The GitHub workspace is enabled only after the following setup.

1. Register an OAuth App at https://github.com/settings/developers (OAuth Apps → New OAuth App).
2. Name: Teachapp Learning Workspace. Homepage: https://teachapp-livid.vercel.app
3. Authorization callback URL: https://teachapp-livid.vercel.app/api/github/callback
4. Store GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET as Worker secrets. Never commit the client secret or paste it in chat.
5. Set GITHUB_USERNAME to the verified student GitHub username. The supplied username currently returns 404; confirm the profile link before enabling.
6. Sign into the journal as the student, open Projects & GitHub, and choose Connect GitHub. The student must authorize the account connection.

The OAuth scope public_repo grants access to public repositories at GitHub (it is not a selected-repository permission). The application's API independently restricts editing to repositories created through this workspace, owned by the connected student, and currently public. No private-repository scope is requested. Tokens are encrypted in D1 with a key derived from the Worker SESSION_SECRET. Rotating that secret requires reconnecting GitHub. Disconnect removes the stored token; revoke authorization in GitHub settings to invalidate the provider grant too.

The editor supports UTF-8 text/code, up to 50 changed files and 100 KB of content per commit. It omits common generated/secret paths and rejects recognized credential patterns; this is not a comprehensive secret scanner. All uploaded code is public. Commits preserve unrelated files and use a non-forced branch update so concurrent changes do not silently overwrite each other. Running code, binary uploads, file deletion and private repositories are outside this initial workflow.

Before calling this integration fully verified, complete student OAuth and test creation, folder import, multi-file commit, existing file edits, and a concurrent edit conflict in a disposable student-owned repository. No student repository was created during automated tests.
