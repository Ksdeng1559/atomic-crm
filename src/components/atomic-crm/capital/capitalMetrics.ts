/**
 * Capital Raise OS — shared business logic.
 *
 * Everything the Capital OS, Goals and Task Board pages need to turn raw CRM
 * records (deals, tasks) into capital-raise numbers lives here, so the three
 * pages always agree on how a metric is calculated (DRY).
 *
 * Business rules encoded here:
 *  - "passed" is the exit stage: those deals never count toward any metric.
 *  - Stage order comes from the admin Settings page (dealStages), so metrics
 *    keep working if stages are renamed or reordered without a code change.
 *  - Goal progress is computed live from deals — nobody types progress numbers
 *    in by hand, except for goals whose metric is "manual".
 */
import type { Deal, Task } from "../types";

/** Route paths for the three Capital OS pages (used by CRM.tsx and Header.tsx). */
export const CAPITAL_ROUTES = {
  dashboard: "/capital",
  goals: "/goals",
  tasks: "/task-board",
} as const;

/** Exit stage: deals the investor declined. Excluded from every metric. */
export const EXIT_STAGE = "passed";
/** Final stage: money received. */
export const FUNDED_STAGE = "funded";

/**
 * Win probability per stage, used for the probability-weighted pipeline.
 * Unknown stages (e.g. added later in Settings) default to 0.
 */
export const STAGE_PROBABILITY: Record<string, number> = {
  identified: 0.05,
  qualified: 0.1,
  contacted: 0.15,
  engaged: 0.25,
  meeting: 0.35,
  "nda-materials": 0.45,
  "due-diligence": 0.6,
  "soft-commitment": 0.75,
  committed: 0.9,
  funded: 1,
  passed: 0,
};

/** How a goal measures its own progress. Mirrors the DB check constraint. */
export type GoalMetric =
  | "pipeline_value"
  | "qualified_pipeline"
  | "investor_conversations"
  | "due_diligence_count"
  | "soft_commitment"
  | "committed"
  | "funded"
  | "manual";

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  pipeline_value: "Open pipeline value ($)",
  qualified_pipeline: "Qualified pipeline value ($)",
  investor_conversations: "Investor conversations (count)",
  due_diligence_count: "Investors in due diligence (count)",
  soft_commitment: "Soft commitments ($)",
  committed: "Committed capital ($)",
  funded: "Funded capital ($)",
  manual: "Manual (enter current value)",
};

/** Metrics measured in dollars (the others are counts). */
const MONEY_METRICS: GoalMetric[] = [
  "pipeline_value",
  "qualified_pipeline",
  "soft_commitment",
  "committed",
  "funded",
];

export const isMoneyMetric = (metric: GoalMetric) =>
  MONEY_METRICS.includes(metric);

/** A row of the `goals` table. parent_id = null means a top-level goal. */
export type Goal = {
  id: number;
  parent_id: number | null;
  title: string;
  metric: GoalMetric;
  target_value: number;
  current_value: number;
  owner_label: string | null;
  due_date: string | null;
  position: number;
};

// ─── Deal helpers ────────────────────────────────────────────────────────────

/** A deal still in play (not declined, not archived). */
export const isLive = (deal: Deal) =>
  deal.stage !== EXIT_STAGE && !deal.archived_at;

/** True when a live deal has reached `stage` or any later stage. */
const reached = (stageOrder: string[], deal: Deal, stage: string) => {
  const target = stageOrder.indexOf(stage);
  return (
    isLive(deal) && target >= 0 && stageOrder.indexOf(deal.stage) >= target
  );
};

const sumAmounts = (deals: Deal[]) =>
  deals.reduce((total, deal) => total + (Number(deal.amount) || 0), 0);

/**
 * Compute the current value of a goal metric from the deals table.
 * `manualValue` is only used when the metric is "manual".
 */
export const computeMetric = (
  metric: GoalMetric,
  deals: Deal[],
  stageOrder: string[],
  manualValue = 0,
): number => {
  switch (metric) {
    case "pipeline_value":
      return sumAmounts(deals.filter(isLive));
    case "qualified_pipeline":
      return sumAmounts(deals.filter((d) => reached(stageOrder, d, "qualified")));
    case "investor_conversations":
      return deals.filter((d) => reached(stageOrder, d, "engaged")).length;
    case "due_diligence_count":
      return deals.filter((d) => reached(stageOrder, d, "due-diligence")).length;
    case "soft_commitment":
      return sumAmounts(
        deals.filter((d) => reached(stageOrder, d, "soft-commitment")),
      );
    case "committed":
      return sumAmounts(deals.filter((d) => reached(stageOrder, d, "committed")));
    case "funded":
      return sumAmounts(deals.filter((d) => d.stage === FUNDED_STAGE));
    case "manual":
    default:
      return Number(manualValue) || 0;
  }
};

/** Probability-weighted value of all live deals. */
export const weightedPipeline = (deals: Deal[]) =>
  deals
    .filter(isLive)
    .reduce(
      (total, d) =>
        total + (Number(d.amount) || 0) * (STAGE_PROBABILITY[d.stage] ?? 0),
      0,
    );

/** Progress as a 0–100 percentage, safe against a zero target. */
export const progressPct = (current: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

// ─── Formatting ──────────────────────────────────────────────────────────────

/** Compact money: 1250000 → "$1.25M". */
export const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value || 0);

export const formatMetric = (metric: GoalMetric, value: number, currency = "USD") =>
  isMoneyMetric(metric) ? formatMoney(value, currency) : String(Math.round(value));

// ─── Task due-date buckets ───────────────────────────────────────────────────

export type DueBucket = "done" | "overdue" | "today" | "week" | "later" | "none";

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "Next 7 days",
  later: "Later",
  none: "No due date",
  done: "Done",
};

/**
 * Read only the calendar date (YYYY-MM-DD) of a stored timestamp, so a task
 * due "Sep 24" stays Sep 24 regardless of the viewer's time zone.
 */
export const toLocalDay = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

const DAY_MS = 86_400_000;

/** Which bucket a task belongs to, relative to today. */
export const dueBucket = (task: Task, now = new Date()): DueBucket => {
  if (task.done_date) return "done";
  if (!task.due_date) return "none";
  const due = toLocalDay(task.due_date).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due <= today + 7 * DAY_MS) return "week";
  return "later";
};

export const formatDay = (value: string | null | undefined) =>
  value
    ? toLocalDay(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

/** Lightweight debug logging (visible in the browser console, filter "[CapitalOS]"). */
export const logCapital = (message: string, data?: unknown) => {
  console.debug(`[CapitalOS] ${message}`, data ?? "");
};
