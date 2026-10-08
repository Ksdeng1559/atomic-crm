# Clerk multi-tenant migration — initial source audit (2026-10-08)

**Status: BLOCKING findings; repository inspection only.** This audit does not establish what database policies are currently deployed. Verify the live Supabase project separately before modifying it.

## Confirmed from current `main`
- `src/components/atomic-crm/root/CRM.tsx` uses `getAuthProvider` and `getDataProvider` from the existing Supabase provider; Clerk is not yet wired into the application.
- `supabase/schemas/05_policies.sql`: contacts, companies, deals, notes, tasks and tags have broad policies for any `authenticated` user (`USING (true)` / `WITH CHECK (true)`). **These are unsafe for mutually isolated organizations** unless replaced with robust tenant policies.
- `supabase/schemas/07_storage.sql`: any authenticated user can select, insert or delete objects in the `attachments` bucket (no tenant/issuer restriction).
- `supabase/schemas/03_views.sql`: `activity_log`, `companies_summary`, `contacts_summary` use `security_invoker=on`, which is suitable *only after* their underlying tables' RLS is tenant-safe; `init_state` uses `security_invoker=off` and must be evaluated for unnecessary visibility.
- The existing README names a dedicated Urban Mining Supabase project, deployed Vercel site and prototype/mock investor records. Production claims need live verification.

## Deployment blockers, in priority order
1. **P0 Tenant isolation:** Add valid tenant mapping and strict RLS (with write checks) across *all* tenant-owned tables and joins, and review functions, views, RPC calls, import/export and MCP endpoint permissions.
2. **P0 Storage:** Replace bucket-wide `attachments` permissions with tenant/issuer-scoped private object access and audit the current bucket visibility.
3. **P0 Authentication transition:** Integrate validated Clerk sessions and active organization membership with Supabase. Inventory existing Supabase Auth identities and migration strategy. Fail closed for no active org.
4. **P0 Referential isolation:** Foreign keys and write operations must not create references between tenants; enforce composite organization-scoped integrity where practicable.
5. **P0 Platform administration:** Clerk `KlickSmartAI.com OS` is a platform organization, **not** automatic unrestricted SQL access. Require explicit privileged server-side platform-admin operations with logged reasons and least privilege.
6. **P0 Token/cache leakage:** Key any persisted React Query/CRM state by organization and user; clear org-specific caches on org switching and sign-out.
7. **P0 Verification:** Test access with at least two organizations and multiple roles. Verify SELECT, INSERT, UPDATE, DELETE, indirect joins, summary views, signed storage URLs and MCP calls.
8. **P0 Change management:** Back up the existing project and use staging credentials. Do not apply schema migrations to production without a documented restoration path and sponsor authorization.

## Next engineering work package
- Inventory each table/column, trigger, RLS policy, storage policy, RPC/function and edge function in the live schema.
- Implement Clerk/Supabase auth adapter and org-aware data-provider prototype behind a feature flag in staging.
- Add `organizations`, membership mapping, scoped issuer and raise entities with declarative schema changes.
- Replace existing broad RLS only after record backfill + validation; keep production running.
- Run cross-tenant penetration tests and verify capital totals independently by issuer.
- Enable Veritas only after checks pass.

## Success criteria
- An Urban Mining member cannot see, mutate, search, export or infer Veritas private data, and vice versa.
- No active organization => no tenant-owned data.
- Revoking membership immediately prevents new authorized data requests.
- Platform admin does not accidentally bypass investor privacy.
- Investor financial data and storage remain issuer-scoped.
- Existing Urban Mining dashboard and CRM remain functional after authorized migration.
