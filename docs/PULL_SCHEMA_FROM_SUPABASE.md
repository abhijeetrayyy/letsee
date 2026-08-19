> **Note (2026-08-19):** the dump target is now `migrations/000_baseline.sql`, which is the
> single source of truth for the schema. `schema.sql` and the old `schema_from_supabase.sql`
> were deleted — see `docs/AGENT_DB_AND_MIGRATIONS.md`. Every reference below has been
> repointed. Note also that `pg_dump` 18 emits `\restrict` / `\unrestrict` meta-commands
> that the Supabase SQL editor rejects; strip them from any dump you intend to paste.

# Pulling schema (and policies) from Supabase

To **retrieve the current tables, functions, and RLS policies** from your live Supabase database (instead of guessing from local files), use the **Supabase CLI** `db dump` command. By default it dumps **schema only** (no data).

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) installed:
  - `npm install -g supabase` or use `npx supabase` in the project.

## Option A: Dump using linked project

If your repo is linked to a Supabase project:

```bash
# One-time: link this project (you’ll need project ref and DB password)
npx supabase link --project-ref YOUR_PROJECT_REF

# Dump schema only (default) to a file
npx supabase db dump -f migrations/000_baseline.sql
```

To dump **only the `public` schema** (recommended so you don’t pull auth/storage internals):

```bash
npx supabase db dump -f migrations/000_baseline.sql -s public
```

Or use the npm script (same as above, assumes project is linked): **`npm run db:dump`**. This writes `migrations/000_baseline.sql` in the project root.

Write it to `migrations/000_baseline.sql`, replacing the previous baseline after review. `git diff` shows exactly what changed in the database since the last dump.

## Option A2: Native pg_dump — no Docker (recommended on this machine)

`npx supabase db dump` runs pg_dump **inside a Docker container**, so on a
machine without Docker Desktop it fails with `LegacyDockerRunError` no matter
which of `--linked`, `--db-url` or `--password` you pass. Linking and
`supabase login` are not the problem — the dump step itself needs Docker.

This machine already has a native pg_dump from Homebrew's `libpq`, which is not
on `PATH` by default:

```bash
/opt/homebrew/opt/libpq/bin/pg_dump --version
```

Dump straight from it, skipping the CLI and Docker entirely. Project ref for
`letsee_2026` is `schsrkmuheekofxewioa`, region `ap-northeast-2`:

```bash
/opt/homebrew/opt/libpq/bin/pg_dump "postgresql://postgres.schsrkmuheekofxewioa:YOUR_PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres" --schema-only --schema=public --no-owner --no-privileges -f migrations/000_baseline.sql
```

If the password contains `@ : / ?` or `#`, percent-encode it, or it will break
the URI parse.

> Never paste a connection string containing a live password into a chat, an
> issue, or a commit. If one does get exposed, rotate it in
> **Project Settings → Database → Reset database password** — that string is the
> `postgres` superuser and grants full read/write/DDL over every table.

## Option B: Dump using database URL (no link)

If you prefer not to link, use the **database connection string** from Supabase:

1. In Supabase: **Project Settings → Database**.
2. Copy the **Connection string** (URI). Use the **Direct connection** (not pooler) for dump. It looks like:
   `postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`
   Or under “Connection string” you may see a **URI** with your password placeholder.
3. Set it as an environment variable (never commit this):

   ```bash
   export SUPABASE_DB_URL="postgresql://postgres.[ref]:YOUR_PASSWORD@...host.../postgres"
   ```

4. Dump schema only:

   ```bash
   npx supabase db dump --db-url "$SUPABASE_DB_URL" -f migrations/000_baseline.sql
   ```

   Only `public` schema:

   ```bash
   npx supabase db dump --db-url "$SUPABASE_DB_URL" -f migrations/000_baseline.sql -s public
   ```

**Note:** The URL must be percent-encoded if it contains special characters (e.g. `&` → `%26`, `/` → `%2F`, `%` → `%25`). Use it only in a secure environment (e.g. your machine, not in CI logs).

**Docker required:** Supabase CLI runs `pg_dump` inside Docker. If you see "Docker client must be run with elevated privileges" or "cannot find the file specified" (Windows), start **Docker Desktop** and rerun, or use Option C below.

## Option C: pg_dump directly (no Docker)

If you have **PostgreSQL client tools** installed ([download](https://www.postgresql.org/download/)) and prefer not to use Docker:

```bash
pg_dump "postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres" --schema-only --schema=public --no-owner --no-privileges -f migrations/000_baseline.sql
```

Replace the URL with your connection string (percent-encode special characters in the password). This produces the same kind of schema-only dump: tables, columns, indexes, functions, enums, triggers, RLS policies.

### Windows: PostgreSQL not showing in terminal

If you installed PostgreSQL but `pg_dump` is not found, the install folder is not in your PATH. Use one of these:

**1. Use the full path** (typical install location; version may be 16 or 18):

- **Command Prompt / PowerShell** (use backslashes and `cd` with drive letter):
  ```cmd
  cd c:\Users\msi\Desktop\letsee\letsee
  "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" "postgresql://postgres:YOUR_ENCODED_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" --schema-only --schema=public --no-owner --no-privileges -f migrations/000_baseline.sql
  ```

- **Git Bash** (use forward slashes; backslashes break paths):
  ```bash
  cd /c/Users/msi/Desktop/letsee/letsee
  "/c/Program Files/PostgreSQL/18/bin/pg_dump.exe" "postgresql://postgres:YOUR_ENCODED_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" --schema-only --schema=public --no-owner --no-privileges -f migrations/000_baseline.sql
  ```

**2. Add PostgreSQL to PATH** (so `pg_dump` works from any folder):

- Press Win + S, type **environment variables**, open **Edit the system environment variables**.
- Click **Environment Variables**.
- Under **User variables** or **System variables**, select **Path** → **Edit** → **New**.
- Add: `C:\Program Files\PostgreSQL\18\bin` (use `16` if you have PostgreSQL 16).
- OK out. **Close and reopen** your terminal (Command Prompt or PowerShell; Git Bash may need a fresh login to pick up PATH), then run:

```cmd
pg_dump "postgresql://..." --schema-only --schema=public --no-owner --no-privileges -f migrations/000_baseline.sql
```

## What you get (full awareness)

A schema-only dump includes everything you and the AI need to know about the database:

- **Tables** — all columns, types, constraints, defaults
- **Indexes** — all indexes on tables
- **Enums / custom types** — e.g. `visibility_level`, `message_type`
- **Functions** — e.g. `profile_visible_to_viewer`, `set_updated_at`, `backfill_watched_episodes_for_show`
- **Triggers** — e.g. `set_updated_at` on tables
- **RLS policies** — every `CREATE POLICY` (who can SELECT/INSERT/UPDATE/DELETE)
- **Grants** — role permissions (if not using `--no-privileges`)

No row data is included (schema only). This file **is** the single source of truth for “what’s in the DB”.

- **Default (no flags):** Schema only — tables, indexes, functions, triggers, RLS policies, etc. No row data.
- **`-f <file>`:** Write the dump to `<file>`.
- **`-s public`:** Restrict to the `public` schema (your app tables, policies, functions and grants), which is what the baseline holds.

## Full backup (schema + data)

For a full backup, run two commands:

```bash
# 1. Schema only
npx supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql

# 2. Data only (COPY statements)
npx supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql --data-only --use-copy
```

Optional: roles only:

```bash
npx supabase db dump --db-url "$SUPABASE_DB_URL" -f roles.sql --role-only
```

## Troubleshooting

### "could not translate host name ... to address: Name or service not known"

This means your machine cannot resolve the Supabase host (DNS failure). Try:

1. **Check internet and DNS** — In Git Bash or PowerShell run:
   ```bash
   ping db.schsrkmuheekofxewioa.supabase.co
   ```
   If this fails, other sites (e.g. `ping google.com`) may still work; then it’s a DNS issue for Supabase’s domain.

2. **Use the exact connection string from Supabase** — In **Supabase Dashboard → Project Settings → Database**, copy the **full URI** (Direct or Session mode). Do **not** type placeholders like `YOUR_REF` or `REGION`; the dashboard shows the real host, e.g.:
   - **Direct:** `db.schsrkmuheekofxewioa.supabase.co:5432`
   - **Session pooler:** `aws-0-us-east-1.pooler.supabase.com:6543` (region and host come from the dashboard)
   Paste that URI into your command and only replace the password part with your URL-encoded password. If the direct host fails with "Name or service not known", try the **Session pooler** URI from the same page.

3. **Flush DNS (Windows)** — In an **elevated Command Prompt** (Run as administrator):
   ```cmd
   ipconfig /flushdns
   ```
   Then retry `pg_dump`.

4. **Temporary DNS** — Try using Google DNS: **Control Panel → Network → Adapter → IPv4 → DNS** set to `8.8.8.8` (or configure it on the router). Then retry.

5. **VPN / firewall** — If you use a VPN or corporate network, try without VPN or from another network; some block Supabase or nonstandard ports.

## Using the dumped file

- **Compare:** Re-dump over `migrations/000_baseline.sql` and read `git diff` — anything that appears is drift between the database and the migrations that were supposed to produce it.
- **Update repo:** Commit the re-dumped baseline. That is the whole update — there is no second file to keep in sync any more, which was the point of deleting it.
- **Audit policies:** Open the dump and search for `CREATE POLICY` to see all RLS policies currently in Supabase.

This way you **don’t guess** — you pull the real schema and policies from Supabase and keep local SQL files in sync.
