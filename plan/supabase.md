# Publishing the database

The most sensitive part of the migration: a published schema is published forever, and it
describes the attack surface of the production database. The audit behind this procedure is
kept out of this repository.

## What we do not do

- **Republish the 133 migrations.** They record eight months of incidents, numbered fixes,
  audits and references to internal infrastructure. Their value is historical, and private.
- **Rewrite the schema by hand.** 46 tables, 148 security definer functions, 40 storage
  policies: a hand rebuild drifts from production without anyone noticing, and holes appear
  exactly in that gap.

## What we do

### 1. Extract the real schema

```bash
supabase db dump --schema public --schema storage -f schema.sql
```

That is the final state of the 133 migrations without their history. A starting point, not a
result.

### 2. Split per phase rather than one large file

The repository publishes as it goes (D14), so the schema follows the code instead of preceding
it.

| File               | Published with   | Contents                                           |
| ------------------ | ---------------- | -------------------------------------------------- |
| `0001_core.sql`    | phase 2          | Profiles, sessions, progress, favourites, lists    |
| `0002_catalog.sql` | phase 4.2        | Catalog, seasons, slug resolution, episode sources |
| `0003_social.sql`  | phase 4.6        | Friends, comments, community                       |
| ...                | after the switch | Credits, referrals, achievements, rooms            |

Each table is reviewed when it is actually needed, and nothing is published just in case. The
credits and referral system, the highest risk area, only goes out after the switch, once it has
been reviewed again.

### 3. Filter every file before pushing it

- **Hardcoded account identifiers.** One migration grants the developer role to a specific
  account id, with the handle in a comment. That is the only piece of personal data in the 133
  files, and it does not ship: in the public repository the first role assignment is
  documented as a manual step rather than written in SQL.
- Comments recounting an incident, an external audit, a numbered fix, or naming internal
  services and domains. The **technical why** is kept and reworded; the operational context
  goes.
- **No permissive policy.** Row level security on with no policy is better than a policy that
  allows everything neutralised by a revoke: the second form depends on the absence of a grant.
- Public storage buckets stay public, which is deliberate; private ones stay private.

### 4. Demo data

A `seed.sql`: fake catalog, a few episodes, the demo source recipe (D12), no real accounts. The
goal is that `supabase start && npm run dev` gives an app that plays a video.

### 5. Turn the audit into a permanent test

This is what matters most over time. The audit was a snapshot; these four queries, run in CI
against the local instance, make it a guarantee. All four must return no rows.

```sql
-- 1. Table without row level security
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2. Security definer function without a pinned search_path (privilege escalation)
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';

-- 3. Policy with an empty or always true predicate
select tablename, policyname from pg_policies
where schemaname = 'public' and (qual is null or btrim(qual) = 'true');

-- 4. Function executable by the anonymous role outside the allow list
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not in ('count_comments', 'online_count');
```

Query 2 catches the most common Supabase mistake. The current schema passes it 148 out of 148,
which is an asset not to lose while rewriting.

### 6. Types and configuration

- `supabase gen types typescript --local`, from the local instance and never from production,
  so the project reference is not needed.
- `supabase/config.toml` with an example project id. The real reference appears in no tracked
  file today, and it stays that way.
- `.env.example` with placeholders. The anonymous key is public by design, which is not a
  reason to publish the production one.

### 7. Edge functions

None are in the repository today. When referrals come back, after the switch: publish the
function code, never the webhook. Document `supabase secrets set` in the README.

### 8. Before the switch

Cross-check with the project's Security Advisor and `supabase db lint`. They see the real state
of the database - dashboard grants, default privileges, storage policies - where a scan of the
files only sees what was written down.

## What publishing the schema reveals, and why that is acceptable

Moderation becomes readable: device bans, thresholds, the concurrent device limit, the version
floor. That is acceptable, since none of these measures depends on being secret. It is still
worth knowing in advance, and worth not describing them as locks in `SECURITY.md`.
