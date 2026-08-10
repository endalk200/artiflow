# Artiflow

Artiflow turns agent-produced documents into private visual experiences
organized by the work they belong to.

## Install the agent Skill

```sh
npx skills add https://github.com/endalk200/artiflow
```

The Artiflow Skill requires the Artiflow CLI:

```sh
npm install -g artiflow
```

## GitHub authentication

Copy `apps/web/.env.example` to `apps/web/.env` and configure the database,
Better Auth secret, public auth URL, and GitHub OAuth app credentials. Set the
GitHub OAuth application's callback URL to:

```text
http://localhost:3000/api/auth/callback/github
```

Use the deployed `BETTER_AUTH_URL` origin instead of localhost in production.
The web app supports GitHub sign-in only. The CLI signs in through the device
authorization page at `/device`; it does not need a GitHub client secret.

Projects created before authentication are deliberately left without an owner
and are hidden from every account after migration. After the intended owner has
signed in once, assign those legacy rows to that user's ID from the `user` table:

```sql
UPDATE projects SET owner_user_id = '<better-auth-user-id>'
WHERE owner_user_id IS NULL;
```

Every Project and Artifact page, management action, and CLI API route requires
authentication. Artifact reads are owner-scoped just like Project reads.
