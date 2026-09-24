/**
 * Capital Raise OS — shared data loading.
 *
 * One hook that loads everything the Capital OS pages need from Supabase
 * (through Atomic CRM's data provider, so Row Level Security still applies).
 * Pages call this instead of wiring their own queries, so they stay in sync.
 *
 * Data volumes for a single capital raise are small (hundreds of records),
 * so we load full lists and compute metrics in the browser. If the investor
 * database grows into the thousands, move the aggregates into a SQL view.
 */
import { useGetList } from "ra-core";
import { useMemo } from "react";

import type { Company, Contact, Deal, Task } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Goal } from "./capitalMetrics";
import { logCapital } from "./capitalMetrics";

const ALL = { page: 1, perPage: 1000 };

export const useCapitalData = () => {
  const config = useConfigurationContext();

  const deals = useGetList<Deal>("deals", {
    pagination: ALL,
    sort: { field: "amount", order: "DESC" },
  });
  const goals = useGetList<Goal>("goals", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "position", order: "ASC" },
  });
  const tasks = useGetList<Task>("tasks", {
    pagination: ALL,
    sort: { field: "due_date", order: "ASC" },
  });
  const contacts = useGetList<Contact>("contacts", { pagination: ALL });
  const companies = useGetList<Company>("companies", { pagination: ALL });

  const isPending =
    deals.isPending ||
    goals.isPending ||
    tasks.isPending ||
    contacts.isPending ||
    companies.isPending;

  const error =
    deals.error || goals.error || tasks.error || contacts.error || companies.error;
  if (error) logCapital("data load error", error);

  /** Stage order as configured in Settings (drives every stage-based metric). */
  const stageOrder = useMemo(
    () => config.dealStages.map((stage) => stage.value),
    [config.dealStages],
  );

  /** Lookup maps so rows can show names without extra queries. */
  const contactById = useMemo(
    () => new Map((contacts.data ?? []).map((c) => [String(c.id), c])),
    [contacts.data],
  );
  const companyById = useMemo(
    () => new Map((companies.data ?? []).map((c) => [String(c.id), c])),
    [companies.data],
  );

  return {
    config,
    stageOrder,
    isPending,
    error,
    deals: deals.data ?? [],
    goals: goals.data ?? [],
    tasks: tasks.data ?? [],
    contacts: contacts.data ?? [],
    contactById,
    companyById,
    refetchGoals: goals.refetch,
  };
};

/** "First Last" for a contact id, or a fallback. */
export const contactName = (
  contactById: Map<string, Contact>,
  id: unknown,
  fallback = "—",
) => {
  const contact = contactById.get(String(id));
  return contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : fallback;
};
