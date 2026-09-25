# Urban Mining Capital CRM

A capital-raise operating system for **Breakthrough Management / Urban Mining LLC**, built on top of the open-source [Atomic CRM](https://github.com/marmelab/atomic-crm) (React + shadcn/ui + Supabase).

It tracks investors, deals and follow-ups for the Phase 1 **$1M raise** (sized from the Foundersuite investor database), and adds a navy-and-gold **Capital Raise OS** layer: a raise dashboard, a goal/milestone tracker and a task board.

- **Live app:** https://urban-mining-crm.vercel.app
- **Hosting:** Vercel (auto-deploys every push to `main`)
- **Backend:** Supabase project `urban-mining-capital-crm` (Postgres, Auth, Storage, Edge Functions)

> The data currently loaded is **mock data** for prototyping. Replace it with real investor records before use.

---

## What's in the app

| Tab | What it shows |
| --- | --- |
| **Dashboard** | Capital Raise OS: raise target & progress, pipeline value, probability-weighted pipeline, soft / committed / funded capital, pipeline by stage, largest open opportunities, operational flags, next milestone, today's to-dos. |
| **Goals** | Goal → Milestone tracker. Progress is calculated **live from the deals pipeline** (no manual entry). Add / delete goals and milestones in place. |
| **Tasks** | Every investor follow-up grouped by urgency (Overdue, Today, Next 7 days, Later, Done). One-click complete; new tasks via Atomic CRM's standard dialog. |
| Contacts / Companies / Deals | Standard Atomic CRM screens (deals Kanban uses the capital-raise stages). |
| **Activity** | Atomic CRM's original dashboard (hot contacts, activity log, deals chart). |

### Capital-raise pipeline

Configured in **Settings** (no code change needed to rename or reorder):

`Identified → Qualified → Contacted → Engaged → Meeting → NDA / Materials → Due Diligence → Soft Commitment → Committed → Funded` plus the exit stage `Passed`.

Investor categories are stored as company sectors: Family Office, Investment Fund, Resource Fund, Impact Fund, Strategic Investor, HNWI, Advisor / Introducer, Other.

---

## Architecture

```
Foundersuite (CSV export)
      │  import (Atomic CRM CSV import — Foundersuite column mapping still to validate)
      ▼
Atomic CRM frontend (React SPA on Vercel)
      │  Supabase JS client (publishable key) + Row Level Security
      ▼
Supabase
  ├─ Postgres: companies, contacts, deals, deal_notes, contact_notes, tasks, tags,
  │            sales (users), configuration, goals (Capital OS)
  ├─ Auth: email/password (+ OAuth server for the MCP connector)
  ├─ Storage: attachments bucket
  └─ Edge Functions: users, update_password, mcp
```

### Capital Raise OS code

All custom code lives in `src/components/atomic-crm/capital/`:

| File | Responsibility |
| --- | --- |
| `capitalMetrics.ts` | Business rules: stage probabilities, goal metric calculations, due-date buckets, formatting, route paths. Single source of truth for every number shown. |
| `useCapitalData.ts` | One hook that loads deals, goals, tasks, contacts and companies through Atomic CRM's data provider (RLS still applies). |
| `osUi.tsx` | Shared navy/gold visual components (page shell, panels, KPI cards, badges, progress bars). |
| `CapitalDashboard.tsx` | Dashboard page (home route `/`). |
| `GoalsPage.tsx` | Goals & milestones page (`/goals`). |
| `TaskBoardPage.tsx` | Task board page (`/task-board`). |

Wiring changes to upstream files are intentionally small:

- `src/App.tsx` — passes `dashboard={CapitalDashboard}` to `<CRM>`.
- `src/components/atomic-crm/root/CRM.tsx` — registers the `/goals`, `/task-board` and `/capital` (Activity) routes.
- `src/components/atomic-crm/layout/Header.tsx` — adds the Goals, Tasks and Activity tabs.

### Goals table

Created by a Supabase migration (not in `supabase/migrations/` of this repo yet):

| Column | Meaning |
| --- | --- |
| `parent_id` | `null` = top-level goal; otherwise the goal this milestone belongs to |
| `metric` | How progress is computed: `pipeline_value`, `qualified_pipeline`, `investor_conversations`, `due_diligence_count`, `soft_commitment`, `committed`, `funded`, or `manual` |
| `target_value` / `current_value` | Target; `current_value` is only used for `manual` goals |
| `owner_label`, `due_date`, `position` | Display owner, target date, ordering |

---

## Configuration

Vercel environment variables:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SB_PUBLISHABLE_KEY` | Supabase **publishable** key (safe for the browser; never put secret/service keys here) |
| `VITE_ATTACHMENTS_BUCKET` | `attachments` |

Supabase dashboard settings still to complete:

1. **Authentication → URL Configuration:** Site URL `https://urban-mining-crm.vercel.app`, redirect URL `https://urban-mining-crm.vercel.app/auth-callback.html`.
2. **Authentication → OAuth Server:** enable, authorization path `/oauth/consent`, allow dynamic client registration (required for the MCP connector).
3. **Custom SMTP** (e.g. Postmark or Resend) before inviting other users.

---

## AI access (MCP server)

The `mcp` edge function exposes the CRM to AI assistants (Claude, ChatGPT, VS Code) over the Model Context Protocol, with the user's own permissions (RLS). The server URL is shown on each user's **Profile** page. See the upstream guide: https://marmelab.com/atomic-crm/doc/users/mcp-server/

---

## Development workflow

- Edit on GitHub (or clone locally) → push to `main` → Vercel builds and deploys automatically.
- After a deploy, refresh the app once: it is a PWA and may serve the previous version from its offline cache.
- Local development (requires Node 22, Docker, Make): `make install` then `make start`. See the upstream [Atomic CRM docs](https://marmelab.com/atomic-crm/doc/).
- To pull upstream component updates: `npx shadcn add https://marmelab.com/atomic-crm/r/atomic-crm.json -o -y` (commit first; review conflicts with the customised files above).

---

## Roadmap

Integrations follow one pattern: the browser never holds third-party API keys. Each external service is called from a Supabase Edge Function, with its key stored as a Supabase secret, and results are written back to CRM records (notes, tasks, deal stage).

### Phase A — Communications & scheduling

1. [ ] **Transactional email (Postmark)** — custom SMTP for Supabase Auth (invites, password reset) so Andy and Gilbert can be invited; then the `postmark` edge function for **inbound email** (CC the CRM to log investor emails as notes). *Prerequisite for multi-user use.*
2. [ ] **Webinar & meeting bookings (Google Calendar)** — booking page via a scheduler that syncs with Google Calendar (Cal.com or Calendly — to be chosen after a pricing/features check). A booking webhook → edge function will: create/match the contact, log the booking as a note, create a follow-up task, and move the deal to *Meeting*. Webinar registrations and attendance shown on the Dashboard.

### Phase B — Intelligence

3. [ ] **Investor brief / lead enrichment (Tavily, Exa.ai)** — "Generate investor brief" button on company and contact pages. Edge function runs targeted web searches (thesis, resource/ESG deal history, fund and cheque size, recent news, contact background), an LLM via OpenRouter writes a one-page brief and scores the four Signal Engine dimensions (Capital Availability, Resource & Gold Interest, ESG Alignment, Relationship Access) with a suggested first talking point. Saved to the record with source links, marked *unverified* until reviewed. Tavily first for briefs; Exa later for "find investors similar to our best ones". Public sources only, no sensitive personal data (PIPEDA / CCPA).
4. [ ] **Dashboard chatbox** — ask for a "Most Important Tasks" briefing from live CRM data and enrichment briefs (edge function → OpenRouter; `OPENROUTER_API_KEY` stored as a Supabase secret). Phased: briefing → read-only Q&A → actions with approval → voice input and daily digest.

### Phase C — Deal execution & compliance

5. [ ] **E-signature** for NDAs and subscription documents (DocuSign, Dropbox Sign or Documenso). Signed NDA → unlock data room; signed subscription docs → deal moves to *Committed*.
6. [ ] **Investor data room** — secure document sharing with view tracking (DocSend, or Supabase Storage signed URLs plus an access log in the CRM).
7. [ ] **Accredited-investor verification (KYC / AML)** — third-party verification status on each investor record (Reg D 506(c) "reasonable steps"; NI 45-106 exemptions). Approach to be confirmed with securities counsel.
8. [ ] **Email sequences** for webinar invites, reminders and follow-ups (compliance-reviewed wording, unsubscribe handling). Separate from transactional email.
9. [ ] **Audit log** — who emailed whom, what was shared, and stage changes over time.

### Housekeeping

- [ ] Validate Foundersuite CSV import column mapping.
- [ ] Voice notes on deals (Whisper-style transcription via the same backend relay pattern).
- [ ] Add the `goals` migration to `supabase/migrations/` so the schema is fully reproducible.
- [ ] Remaining upstream edge functions: `merge_contacts`, `delete_note_attachments`.
- [ ] Complete Supabase Auth settings (Site URL, OAuth Server) — see *Configuration*.

### Done

- [x] Atomic CRM fork deployed on Vercel with Supabase backend.
- [x] Capital-raise pipeline stages, investor categories, mock investor data.
- [x] Capital Raise OS dashboard (home), Goals & milestones, Task board.
- [x] MCP server edge function for AI assistants.

---

## Compliance note

This tool supports a private placement process. It does not make investment offers, and investor-facing content must go through legal review (NI 45-106 / Reg D 506(c)). Mock data only until real records are imported.

## License

MIT, inherited from [Atomic CRM](https://github.com/marmelab/atomic-crm) by Marmelab. See `LICENSE.md`.
