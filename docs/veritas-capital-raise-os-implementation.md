# Veritas Capital Raise OS — implementation specification

Status: Design only. Do not deploy or migrate production data until tenant isolation and securities workflows are reviewed.

## Existing foundation (verified)
- This repository is the **Urban Mining Capital CRM** fork of Atomic CRM, React/Vite + Supabase.
- The custom capital UI exists in `src/components/atomic-crm/capital/`: `CapitalDashboard.tsx`, `GoalsPage.tsx`, `TaskBoardPage.tsx`, `capitalMetrics.ts`, `useCapitalData.ts`, `osUi.tsx`.
- Existing raise stages in README: Identified, Qualified, Contacted, Engaged, Meeting, NDA / Materials, Due Diligence, Soft Commitment, Committed, Funded; Passed.
- The README describes an **Urban Mining** Vercel deployment and dedicated Supabase project, and notes mock prototype data.
- `AGENTS.md` specifies declarative DB source of truth under `supabase/schemas/`, with migrations generated from schema differences.

## Business requirements
1. Veritas Development Group is a separate capital-raising tenant from Urban Mining.
2. Stage A: proposed **USD 50,000** corporate readiness financing, separated from the formal securities offering and sourced through an authorized financing structure.
3. Stage B: proposed USD 500,000–1,000,000 capital campaign, only after an issuer/offering and underwriting are approved.
4. **USD 100,000** minimum investor subscription for formal Veritas offerings; no fabricated funded or legally-committed values.
5. Subsequent offerings belong to **independent project SPVs** (Evermont, Brookstone, Grandview Commercial; future Green Acres parcels).
6. The system must distinguish investors, introducers, financing lenders, legal issuers, offerings, subscriptions and verified receipts.

## Approved target architecture — v1.1 (2026-10-08)
**Decision:** KlickSmartAI is the parent platform administrator. Use **Clerk Organizations + one shared Supabase project + one Atomic CRM codebase** for Veritas, Urban Mining and future tenant clients, subject to successful audit and isolation tests. The former separate-project recommendation is superseded as the target; a parallel development/staging environment may still be used for migration safety.

### Identity and authorization
- Clerk authenticates users; each Clerk Organization maps to one tenant organization in `organizations`. Do not use sample `org_veritas` strings as production Clerk IDs.
- Platform-admin rights (KlickSmartAI) are maintained in a **server-managed allowlist/role binding**, separate from tenant organization membership. Being a member of one tenant never confers access to others.
- Tenant roles: `tenant_admin`, `capital_manager`, `relationship_manager`, `underwriter`, `viewer`. Separate project/issuer grants and counsel-controlled access.
- Resolve active org from a *validated* Clerk session/JWT; deny access when absent or when membership is invalid. Do not trust a client-provided tenant ID by itself.
- Evaluate current recommended Clerk↔Supabase third-party token integration; verify emitted token claims and Supabase role mapping against actual current docs before implementing. Existing Supabase Auth users require an explicit identity-mapping and migration plan.

### Shared Supabase tenant boundary
- Add `organization_id` to **all tenant-owned** CRM tables and the new capital tables: contacts, companies, deals, notes, tasks, goals, stage configuration, projects, raises, investor profiles, subscriptions, receipts, relationship links and activity history.
- Tenant-aware foreign keys or equivalent enforced relational constraints must prevent cross-tenant references. All CRUD policies require validated active membership; `USING` and `WITH CHECK` on writes, no unauthenticated access and no accidental null-org global access.
- Review `supabase/schemas/01_tables.sql`, `03_views.sql`, `05_policies.sql`, `06_grants.sql`, `07_storage.sql`, edge functions, import paths, joins and MCP tools. Avoid `SECURITY DEFINER`/service-role bypasses unless independently authorized and audited.
- Private storage paths carry tenant + issuer scope; use short-lived authorized signed URLs and access logs. Avoid exposing sensitive investor documents through public buckets.
- Separate *shared public-source research* (permissioned and provenance-stamped) from tenants' confidential notes, relationship histories and subscriptions.
- Platform-wide administration must use separate server-side authorization with an auditable, explicit cross-tenant access action, not a broad browser query enabled by a token claim.

### Isolation and migration safeguards
1. Baseline and backup the existing Urban Mining project and current schema; confirm data currently described as mock in the README.
2. Introduce organization and identity mapping; backfill existing CRM records to Urban Mining tenant under an explicit reviewed migration.
3. Add Clerk integration and tenant-aware RLS policies in **staging**; verify old identity compatibility and a documented cutover/rollback strategy.
4. Provision Veritas organization and config only after the isolation test suite passes.
5. No automatic migration of secrets or live investor data; no modification of the existing production deployment until explicitly approved.

### Parent admin console — minimum scope
- Provision/suspend organizations; invite/remove authorized memberships; assign tenant roles.
- Configure tenant branding, currency defaults, investment minimum, permitted stages, enabled modules and issuer authorization.
- View tenant health and high-level operations; cross-tenant confidential record access only under explicit just-in-time privilege with immutable audit and documented business justification.
- Review agent actions, compliance approvals, audit logs, and tenant-level subscription/usage metering.
- Support export and offboarding by tenant.

### P0 security acceptance tests
- A Veritas user cannot read/write/list/search/export Urban Mining contacts, investor profiles, deals, tasks, subscriptions, receipts, attachments or MCP results, and vice versa.
- Changing client-side org headers/IDs cannot bypass access rules; revoked Clerk memberships lose access.
- Platform admin actions require distinct privileged identity and have an audit trail.
- Funding totals and CRM stage settings are filtered by active organization *and* issuer; no cross-tenant aggregation in tenant dashboards.
- No public offering communications occur before securities-counsel workflow approval.
- Verify migration rollback and backup restoration in staging.

## Functional module backlog
| ID | Priority | Description | Validation |
|----|----------|-------------|------------|
| VC-01 | P0 | Separate Veritas config (branding, company sectors, real estate stages) | Urban Mining's UI/data unchanged |
| VC-02 | P0 | Legal issuer and offering entities | Offers are scoped to issuer/SPV |
| VC-03 | P0 | Investor profile + relationship/introducer records | Investors may be linked to multiple offerings |
| VC-04 | P0 | Investor-opportunity stage log | All changes attributed and time-stamped |
| VC-05 | P0 | USD 100,000 minimum accepted subscription rule | Reject subminimum unless explicit, documented authorized exception |
| VC-06 | P0 | Soft-circle vs executed subscription vs confirmed receipt ledger | Funded equals reconciled receipts only |
| VC-07 | P0 | Issuer-scoped diligence and document access | Unauthorized cross-issuer access fails |
| VC-08 | P0 | Solicitation and human-approval policy gates | AI cannot dispatch unapproved securities promotions |
| VC-09 | P0 | Veritas KPI dashboard | No combined Urban Mining totals |
| VC-10 | P1 | Hermes investor briefing, citations and confidence | Unverified claims labeled |
| VC-11 | P1 | Project readiness integration, Green Acres 6-gate underwriting | No gate auto-approval |
| VC-12 | P1 | Approved video/webinar and follow-up workflows | Approval log preserved |

## Investor pipeline
Identified → Researched → Qualified → Introduction Requested → Contacted → Engaged → Meeting Completed → Materials / Due Diligence → Soft Commitment → Legally Committed → Funded. Separate dispositions: Passed, Deferred, Unresponsive, Disqualified, Follow-up Later.

Do not rename the existing Urban Mining pipeline globally: stage configuration must be tenant- and offering-scoped.

## Data model proposal (not yet implemented)
- `issuers`: id, legal_name, jurisdiction, tenant_id
- `raises`: id, issuer_id, currency, target_amount, status, minimum_subscription, legal_approval_reference
- `investor_profiles`: investor_company_id, investor_type, mandate, fit_score, review_status
- `investor_opportunities`: id, investor_id, raise_id, owner_id, stage, status, soft_circle_amount
- `subscriptions`: id, opportunity_id, executed_amount, accepted_at, approval_reference
- `funding_receipts`: id, subscription_id, amount, currency, reconciled_at, verifier_id
- `relationship_edges`: source_contact_id, target_contact_id, introducer_id, evidence_ref
- `diligence_requests`: opportunity_id, document_id, status, owner_id
- `approvals`: object_type, object_id, policy, actor_id, decision, timestamp
- `pipeline_events`: opportunity_id, previous_stage, next_stage, actor_id, reason, timestamp

All monetary data uses fixed-precision decimal; rows have audit timestamps, provenance and authorization policies. A later multi-tenant design must consistently enforce `tenant_id` at the DB, storage and edge-function layers.

## KPI requirements
- Prospect funnel: researched / qualified / engaged / meetings / diligence.
- Capital: target, nonbinding soft-circle, legally committed, verified funded, funding gap, average funded subscription.
- Project: readiness gate, approved documents, unanswered diligence, actual vs approved predevelopment budget.
- Explicitly label all 30/60/90-day targets as planning assumptions.

## Outreach SOP
Research with citation → relationship map → lawful-channel check → human/counsel campaign clearance → personalized introduction → meeting and qualification → permissioned materials → counsel-led subscription and verification → finance-confirmed receipt.

Do not send public securities ads or bulk solicitations until the applicable exemption, intermediary role and cross-border rules are approved.

## Required tests
1. Existing Urban Mining capital dashboard has no Veritas data, logos or changed financial assumptions.
2. Existing Urban Mining imports, goals, tasks, stage configuration, and MCP access continue operating.
3. Under USD 100,000 Veritas subscription cannot be accepted without documented authorized exception.
4. Soft commitment and executed-but-unfunded subscription do not increase Funded.
5. RLS/access tests block cross-project and cross-tenant data reads/writes/downloads.
6. All collateral has version and approval provenance; no AI-initiated unapproved outreach.
7. Migration rollback, local test data and backup plan documented before deploying.

## Delivery sequence
**Sprint 0:** audit current Supabase Auth, existing schema/policies and production data; map tenant-owned tables, secrets, MCP and storage; back up and prepare rollback.
**Sprint 1:** Clerk Organizations + KlickSmartAI parent admin design; staging migrations and tenant mapping; test tenant-aware RLS and auth cutover.
**Sprint 2:** Veritas organization provisioning, tenant-scoped issuer/raise/investor pipeline, subscription/receipt rules; unit and adversarial RLS tests.
**Sprint 3:** permissioned data room, approvals, investor intelligence and dashboard.
**Sprint 4:** verified import, UAT, legal sign-off and controlled pilot.

## Acceptance decision
Sponsor: David Poole / Daniel Bailey. Capital OS: Dennis Eng. Securities/offering: appropriately authorized U.S. counsel and any relevant Canadian counsel. Production launch only after security and compliance gate sign-off.
