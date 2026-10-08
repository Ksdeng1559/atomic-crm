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

## Implementation architecture decision gate (blocking)
The current repo has a dedicated Urban Mining Supabase backend. **Do not simply add Veritas to the existing Urban Mining CRM by tags or deal categories**. The safe MVP is a **separately deployed Veritas instance with its own Supabase project and credentials**, reusing this repo's UI and business logic. An eventual shared, multi-tenant database requires a separate review of all tables, views, storage, edge functions, imports, MCP endpoints and RLS policies.

Select one deployment mode explicitly before implementation:
- **A (recommended first): isolated Veritas Vercel/Supabase deployment** from a reviewed branch/fork, retaining Urban Mining deployment as-is.
- **B (future): shared multi-tenant platform**, only after schema-wide tenant IDs, tenant-bound foreign keys, verified RLS, protected storage, issuer-level authorization and adversarial access tests.

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

Do not rename the existing Urban Mining pipeline globally: make the stages configurable per separate instance or per offering after multi-tenant controls exist.

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
**Sprint 0:** approve isolation architecture; inspect current deployed Supabase schema and real data; check secrets/public repository exposure; inventory existing integration/CI/deployment.
**Sprint 1:** configure isolated Veritas deployment and issuer/raise/investor data model, with generated migrations.
**Sprint 2:** opportunity pipeline and subscription/receipt rules; unit and RLS tests.
**Sprint 3:** permissioned data room, approvals, investor intelligence and dashboard.
**Sprint 4:** verified import, UAT, legal sign-off and controlled pilot.

## Acceptance decision
Sponsor: David Poole / Daniel Bailey. Capital OS: Dennis Eng. Securities/offering: appropriately authorized U.S. counsel and any relevant Canadian counsel. Production launch only after security and compliance gate sign-off.
