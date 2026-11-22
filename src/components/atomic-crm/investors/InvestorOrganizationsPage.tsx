import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../providers/supabase/supabase";

type Organization = {
  id: number;
  organization_name: string;
  research_tier: "A" | "B" | "C" | null;
  category: string | null;
  location: string | null;
  focus_rationale: string | null;
  mandate_caveat: string | null;
  website_research_url: string | null;
  source_document_url: string | null;
  source_class: string | null;
  notion_page_url: string;
  verification_status: string;
  outreach_gate: string;
};

type InvestorContactLink = {
  organization_id: number;
  contact_notion_page_url: string;
};

const verificationOptions = [
  "Research Pending",
  "Source Verified",
  "Mandate Verified",
  "Qualified",
  "Excluded",
];

const categories = [
  "Family Office",
  "Multi-Family Office",
  "Family Capital / Investment Company",
  "Advisor / Gatekeeper",
  "Classification Pending",
];

const safeUrl = (value: string | null) =>
  value && /^https:\/\//i.test(value) ? value : undefined;

/**
 * Dedicated investor organization research queue, separate from CRM companies.
 * Outreach status is deliberately read-only. Qualification does not authorize contact.
 */
export function InvestorOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contactLinks, setContactLinks] = useState<InvestorContactLink[]>([]);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("All");
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const [organizationResult, linksResult] = await Promise.all([
      supabase
        .from("investor_organizations")
        .select("*")
        .order("research_tier", { ascending: true })
        .order("organization_name", { ascending: true }),
      supabase
        .from("investor_organization_contacts")
        .select("organization_id,contact_notion_page_url"),
    ]);
    if (organizationResult.error || linksResult.error) {
      setError(
        organizationResult.error?.message ??
          linksResult.error?.message ??
          "Unable to load investor research",
      );
    } else {
      setOrganizations((organizationResult.data ?? []) as Organization[]);
      setContactLinks((linksResult.data ?? []) as InvestorContactLink[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(
    () =>
      organizations.filter((item) => {
        const matchesTier = tier === "All" || item.research_tier === tier;
        const searchable = [
          item.organization_name,
          item.location,
          item.category,
          item.focus_rationale,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return matchesTier && searchable.includes(search.toLowerCase().trim());
      }),
    [organizations, search, tier],
  );

  const open = (item: Organization) => {
    setSelected(item.id);
    setDraft({ ...item });
    setNotice(null);
    setError(null);
  };

  const updateDraft = (key: keyof Organization, value: string) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  async function save() {
    if (!draft || selected === null) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    // Outreach decisions are never modified by this form.
    const changes = {
      category: draft.category,
      location: draft.location,
      focus_rationale: draft.focus_rationale,
      mandate_caveat: draft.mandate_caveat,
      verification_status: draft.verification_status,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await getSupabaseClient()
      .from("investor_organizations")
      .update(changes)
      .eq("id", selected);
    if (updateError) {
      setError(updateError.message);
    } else {
      setOrganizations((current) =>
        current.map((item) =>
          item.id === selected ? { ...item, ...changes } : item,
        ),
      );
      setNotice("Research record saved. Outreach remains on hold.");
    }
    setSaving(false);
  }

  const linked = selected === null
    ? []
    : contactLinks.filter((item) => item.organization_id === selected);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-semibold">Investor Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Urban Mining family offices and family capital. Research does not equal
          investor suitability, expressed interest, or permission to solicit.
        </p>
      </div>
      <div className="rounded-lg border p-4 text-sm">
        <strong>{organizations.length} organizations</strong> ·{" "}
        {organizations.filter((item) => item.outreach_gate === "HOLD — no outreach").length}{" "}
        on outreach hold · {contactLinks.length} linked Notion contact records
      </div>
      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Search investor organizations"
          placeholder="Search name, category, location, thesis"
          className="min-w-64 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filter research tier"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={tier}
          onChange={(event) => setTier(event.target.value)}
        >
          <option>All</option>
          <option>A</option>
          <option>B</option>
          <option>C</option>
        </select>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          Refresh
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {loading ? (
        <p className="text-sm">Loading investor research…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3">Organization</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Category</th>
                <th className="p-3">Location</th>
                <th className="p-3">Verification</th>
                <th className="p-3">Outreach</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/20">
                  <td className="p-3">
                    <button
                      type="button"
                      className="text-left font-medium underline underline-offset-2"
                      onClick={() => open(item)}
                    >
                      {item.organization_name}
                    </button>
                  </td>
                  <td className="p-3">{item.research_tier ?? "—"}</td>
                  <td className="p-3">{item.category ?? "—"}</td>
                  <td className="p-3">{item.location ?? "—"}</td>
                  <td className="p-3">{item.verification_status}</td>
                  <td className="p-3">{item.outreach_gate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="p-4 text-sm">No organizations match these filters.</p>
          )}
        </div>
      )}
      {draft && (
        <section className="space-y-4 rounded-lg border p-4" aria-label="Investor research details">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{draft.organization_name}</h2>
              <p className="text-sm text-muted-foreground">
                Research tier {draft.research_tier ?? "unassigned"} · {draft.source_class ?? "Source unclassified"}
              </p>
            </div>
            <button type="button" onClick={() => { setDraft(null); setSelected(null); }} className="rounded-md border px-3 py-1 text-sm">
              Close
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Category
              <select
                value={draft.category ?? ""}
                onChange={(event) => updateDraft("category", event.target.value)}
                className="rounded-md border bg-background px-3 py-2"
              >
                <option value="">Unclassified</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Verification status
              <select
                value={draft.verification_status}
                onChange={(event) => updateDraft("verification_status", event.target.value)}
                className="rounded-md border bg-background px-3 py-2"
              >
                {verificationOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Location
              <input value={draft.location ?? ""} onChange={(event) => updateDraft("location", event.target.value)} className="rounded-md border bg-background px-3 py-2" />
            </label>
            <div className="grid gap-1 text-sm">
              Outreach gate
              <p className="rounded-md border bg-muted px-3 py-2">{draft.outreach_gate}</p>
              <span className="text-xs text-muted-foreground">Read-only; requires separate human and legal approval.</span>
            </div>
            <label className="grid gap-1 text-sm md:col-span-2">
              Investment focus / rationale
              <textarea rows={2} value={draft.focus_rationale ?? ""} onChange={(event) => updateDraft("focus_rationale", event.target.value)} className="rounded-md border bg-background px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              Mandate caveat and verification gaps
              <textarea rows={2} value={draft.mandate_caveat ?? ""} onChange={(event) => updateDraft("mandate_caveat", event.target.value)} className="rounded-md border bg-background px-3 py-2" />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {safeUrl(draft.website_research_url) && <a target="_blank" rel="noreferrer" className="underline" href={draft.website_research_url!}>Research source</a>}
            {safeUrl(draft.source_document_url) && <a target="_blank" rel="noreferrer" className="underline" href={draft.source_document_url!}>Source document</a>}
            {safeUrl(draft.notion_page_url) && <a target="_blank" rel="noreferrer" className="underline" href={draft.notion_page_url}>Notion organization</a>}
          </div>
          <div className="text-sm">
            <h3 className="font-semibold">Linked investor contacts ({linked.length})</h3>
            {linked.length ? (
              <ul className="mt-2 list-inside list-disc space-y-1">
                {linked.map((contact) => (
                  <li key={contact.contact_notion_page_url}>
                    <a className="underline" href={contact.contact_notion_page_url} target="_blank" rel="noreferrer">
                      Open linked Notion contact
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">No linked contact in the current research batch.</p>}
          </div>
          <button type="button" onClick={() => void save()} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {saving ? "Saving…" : "Save research fields"}
          </button>
        </section>
      )}
    </div>
  );
}
