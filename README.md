# AIDeck

A department portal prototype for the shared Supabase Auth project. Members see
their assigned Signora and GT AI Ticketing sites, plus authorized RiskScreen
installer downloads. Session Track is listed as Upcoming until its source and
integration access are available.

## Current implementation

- Next.js portal with member login, invitation completion, application cards,
  central Super administrator and site administrator screens, existing-user
  approval, assignment management, retryable profile provisioning, and audit
  history.
- Server-checked application launch and RiskScreen download. The installer
  route checks a ready assignment, validates GitHub's release size and SHA-256
  metadata, and redirects to GitHub's temporary asset URL or streams its body.
- Supabase OAuth 2.1 authorization UI in the portal. Confidential OAuth clients
  with Authorization Code and PKCE are implemented in the neighboring Signora
  and Ticketing repositories. Ticketing refreshes OAuth tokens through the
  OAuth token endpoint; Signora issues a site session capped by the OAuth access
  token lifetime.

## Local setup

1. Run `npm ci` and copy `.env.example` to `.env.local`. Fill in the existing
   Supabase URL, publishable key and server-only secret key. Set `PORTAL_URL` to
   the portal's exact origin and `DATABASE_URL` to a dedicated portal database
   login. Keep all credentials in ignored local files or deployment secrets.
2. Apply `db/001_portal.sql` and `db/002_runtime_access.sql` as a database owner.
   Set a strong password and `LOGIN` on `aideck_runtime` separately. Existing
   installations that applied an earlier runtime access script should also run
   `db/003_remove_direct_auth_access.sql`. The runtime login uses narrowly
   granted tables and never queries `auth.users`; identity lookup uses the
   Supabase Admin API on the server.
3. Run `npm run dev`, then open `http://localhost:3000`. Use an existing Auth
   user that has an active `aideck.members` record. New members are invited from
   the Administration page. The three initial Super administrators were
   bootstrapped in the shared Supabase project using verified Auth IDs; their
   identifiers and database credentials are not stored in this repository.

The local portal has been configured with an ignored `.env.local` on the
development machine. Its database login was checked against the portal,
Signora, and Ticketing tables. Local sign-in still requires a valid member's
existing password and the matching Supabase redirect settings.

## OAuth setup for an integrated environment

Keep the rollout sequence and acceptance gates in local project notes.

1. Deploy the portal and both site changes to stable HTTPS origins. Inventory
   every existing confirmation, invitation, recovery, and callback URL before
   changing the shared project's Auth Site URL.
2. Enable the Supabase OAuth server, point its Site URL to the portal origin,
   and set its authorization path to `/oauth/consent`.
3. Register separate confidential clients using `client_secret_basic` and exact
   callback URLs: `https://signora-web.vercel.app/auth/portal/callback` and
   `https://gt-ai-ticketing.vercel.app/auth/portal/callback`. Store each client
   ID and secret in that site's server environment. Signora needs
   `SIGNORA_OAUTH_CLIENT_ID`, `SIGNORA_OAUTH_CLIENT_SECRET`, and
   `SIGNORA_OAUTH_REDIRECT_URI` in its web deployment, plus the client ID in its
   API deployment. Ticketing needs the corresponding `TICKETING_OAUTH_*` values.
4. Verify first-use consent, direct sign-in, callback state validation, token
   refresh, session expiry, local sign-out, and global sign-out in a test
   environment before changing production Auth settings.
5. Set `SIGNORA_OAUTH_READY=true` and `TICKETING_OAUTH_READY=true` in the portal
   only after each site's OAuth routes are deployed and its client is configured.
   Until then, its portal card opens the existing site with a clearly labeled
   separate sign-in, avoiding a missing OAuth route.

The shared production project's OAuth server is still disabled. An isolated
Supabase test project now has its own OAuth server and two local clients. Local
browser tests reached both Signora and Ticketing dashboards from the portal
without another password. The remaining HTTPS staging and production gates are
listed in the rollout plan; production one-login is not enabled yet.

## RiskScreen release setup

Set `GITHUB_RELEASE_OWNER`, `GITHUB_RELEASE_REPO`, and a server-only
`GITHUB_RELEASE_TOKEN` with read access to the private release repository. The
release must be published, stable, and contain
`RiskScreen-Setup-<version>.exe` with a GitHub `sha256:` digest. The private
release repository is `SY-Automation/riskscreen`. The published `v1.0.2`
installer was streamed through GitHub's 302 response and its 166,226,272 bytes
matched the release SHA-256 digest. The protected portal download route still
needs an authenticated browser check after deployment and a dedicated read-only
GitHub token.

## Repository Guidelines

- Do not commit secrets, tokens, or `.env` files containing real credentials.
- Use `.editorconfig` to keep basic text formatting consistent.
- Update `.gitignore` for generated files when adding a language or tool.
- Keep repository files and Git messages in English.
- Track the root `README.md`; keep superpowers files and other Markdown notes and plans local.

## Git Conventions

### Commit messages

Use this title format:

```text
<type>(<scope>): <imperative summary>
```

Use lowercase `type` and `scope`. Keep the title at or below 72 characters, start the summary with an imperative verb, and omit the final period. The scope is a short name for the affected area, such as `deck`, `export`, or `repo`.

Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, and `revert`.

For commits that need explanation, leave a blank line after the title and use this body format:

```text
Why:
- Explain the reason for the change.

Changes:
- Summarize the main changes.

Validation:
- State what was checked, or write "Not run" with a reason.
```

Example title: `feat(deck): add slide export`.

The repository includes a `.gitmessage` template. To use it in a clone, run `git config --local commit.template .gitmessage`.

### Branch names

Create branches from the latest `main` and name them `<type>/<short-kebab-description>`. Use an allowed commit type, lowercase English words, digits when needed, and hyphens between words. If there is an issue number, put it first in the description: `feat/123-slide-export`.

Examples: `feat/slide-export`, `fix/empty-deck-export`, `docs/update-setup`.

## Status

The portal is deployed to Vercel Production at
https://aideck-portal.vercel.app. The deployment was uploaded directly from
this local working tree; the Vercel project is not connected to the GitHub
repository, so future source changes require another deployment.

Production uses the existing remote Supabase project and its PostgreSQL pooler,
not a database on the development machine. The portal's production origin is
configured in Vercel. Both site OAuth readiness flags remain false while the
staging and production OAuth gates in the rollout plan are incomplete. The
RiskScreen appears as Coming soon until a dedicated read-only
`GITHUB_RELEASE_TOKEN` is configured and the portal is redeployed. Supabase
Auth URL settings and an authenticated production browser check still need to
be reviewed before treating invitations and one-login flows as fully released.
