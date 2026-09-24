/**
 * Capital Raise OS — Dashboard page (route: /capital).
 *
 * The "two-minute read" for management: where the raise stands, how the
 * pipeline is distributed, what needs attention today. Every number is
 * computed live from the CRM's deals, tasks and goals — no manual entry.
 */
import { Link } from "react-router";

import type { Deal } from "../types";
import {
  CAPITAL_ROUTES,
  FUNDED_STAGE,
  computeMetric,
  dueBucket,
  formatDay,
  formatMetric,
  formatMoney,
  isLive,
  progressPct,
  weightedPipeline,
} from "./capitalMetrics";
import { Badge, KpiCard, OsLoading, OsPage, Panel, ProgressBar } from "./osUi";
import { contactName, useCapitalData } from "./useCapitalData";

const STALE_DAYS = 14;
const DEFAULT_RAISE_TARGET = 1_000_000;

export const CapitalDashboard = () => {
  const data = useCapitalData();
  const { config, stageOrder, deals, goals, tasks, contacts, contactById, companyById } = data;
  const currency = config.currency;

  if (data.isPending) {
    return (
      <OsPage eyebrow="Capital Raise OS" title="Capital Raise Dashboard">
        <OsLoading />
      </OsPage>
    );
  }

  // ── Headline numbers ──────────────────────────────────────────────────────
  const topGoal = goals.find((g) => g.parent_id == null);
  const raiseTarget = Number(topGoal?.target_value) || DEFAULT_RAISE_TARGET;
  const live = deals.filter(isLive);
  const openDeals = live.filter((d) => d.stage !== FUNDED_STAGE);
  const pipelineValue = computeMetric("pipeline_value", deals, stageOrder);
  const weighted = weightedPipeline(deals);
  const soft = computeMetric("soft_commitment", deals, stageOrder);
  const committed = computeMetric("committed", deals, stageOrder);
  const funded = computeMetric("funded", deals, stageOrder);
  const raisePct = progressPct(committed, raiseTarget);

  // ── Tasks / operational flags ─────────────────────────────────────────────
  const openTasks = tasks.filter((t) => !t.done_date);
  const overdue = openTasks.filter((t) => dueBucket(t) === "overdue");
  const dueToday = openTasks.filter((t) => dueBucket(t) === "today");

  // An open deal is "missing a next action" when none of its contacts has an open task.
  const contactsWithOpenTask = new Set(openTasks.map((t) => String(t.contact_id)));
  const missingNextAction = openDeals.filter(
    (d) => !(d.contact_ids ?? []).some((id) => contactsWithOpenTask.has(String(id))),
  );

  const staleCutoff = Date.now() - STALE_DAYS * 86_400_000;
  const staleInvestors = contacts.filter(
    (c) => c.last_seen && new Date(c.last_seen).getTime() < staleCutoff,
  );

  // Next milestone = first milestone (in order) that is not yet complete.
  const nextMilestone = goals
    .filter((g) => g.parent_id != null)
    .map((g) => ({
      goal: g,
      current: computeMetric(g.metric, deals, stageOrder, g.current_value),
    }))
    .find(({ goal, current }) => current < Number(goal.target_value));

  const topDeals = [...openDeals]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 6);

  const attentionTasks = [...overdue, ...dueToday].slice(0, 6);

  return (
    <OsPage
      eyebrow="Capital Raise OS · Live CRM data"
      title="Capital Raise Dashboard"
      subtitle={`Raise status and immediate priorities at a glance. Target: ${formatMoney(raiseTarget, currency)}.`}
      actions={
        <>
          <Link to={CAPITAL_ROUTES.goals} className="text-xs font-semibold text-[#c9a84c] hover:underline">
            Goals →
          </Link>
          <Link to={CAPITAL_ROUTES.tasks} className="text-xs font-semibold text-[#c9a84c] hover:underline">
            Tasks →
          </Link>
        </>
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Raise Target" value={formatMoney(raiseTarget, currency)} tone="gold" sub={`${raisePct}% committed`} />
        <KpiCard label="Pipeline Value" value={formatMoney(pipelineValue, currency)} tone="gold" sub={`${live.length} live deals`} />
        <KpiCard label="Weighted Pipeline" value={formatMoney(weighted, currency)} sub="Probability-adjusted" />
        <KpiCard label="Soft Commitments" value={formatMoney(soft, currency)} tone="amber" sub="Soft + committed + funded" subTone="muted" />
        <KpiCard label="Committed Capital" value={formatMoney(committed, currency)} tone="green" sub="Subscription docs out or funded" subTone="muted" />
        <KpiCard label="Funded Capital" value={formatMoney(funded, currency)} sub={funded > 0 ? "Wires received" : "First close pending"} subTone="muted" />
        <KpiCard label="Tasks Due Today" value={dueToday.length} tone="amber" sub={`${openTasks.length} open tasks`} subTone="muted" />
        <KpiCard label="Overdue Tasks" value={overdue.length} tone={overdue.length ? "red" : "green"} sub="Needs owner review" subTone="muted" />
      </div>

      {/* Raise progress */}
      <Panel gold eyebrow="Raise Progress" className="mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <div className="text-sm">
            <span className="text-[#34d399] font-bold">{formatMoney(committed, currency)}</span>
            <span className="text-[#8a9ab0]"> committed of </span>
            <span className="text-[#c9a84c] font-bold">{formatMoney(raiseTarget, currency)}</span>
          </div>
          <Badge tone={raisePct >= 100 ? "green" : "gold"}>{raisePct}%</Badge>
        </div>
        <ProgressBar pct={raisePct} />
      </Panel>

      {/* Pipeline stage strip */}
      <Panel eyebrow="Investor Pipeline by Stage" className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {config.dealStages.map((stage, i) => {
            const inStage = deals.filter((d) => d.stage === stage.value && !d.archived_at);
            const value = inStage.reduce((t, d) => t + (Number(d.amount) || 0), 0);
            const isExit = stage.value === "passed";
            return (
              <Link
                key={stage.value}
                to="/deals"
                className={`flex-[0_0_118px] rounded-md border p-3 bg-[#111f33] hover:border-[#c9a84c]/40 ${
                  isExit ? "border-[#f87171]/20 opacity-75" : "border-white/5"
                }`}
              >
                <div className="text-[10px] font-bold text-[#4a5a70] tracking-widest">
                  {isExit ? "—" : String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-[11px] font-bold leading-tight mt-0.5">{stage.label}</div>
                <div className={`text-xl font-extrabold mt-1 ${isExit ? "text-[#f87171]" : "text-[#c9a84c]"}`}>
                  {inStage.length}
                </div>
                <div className="text-[10px] text-[#4a5a70]">{formatMoney(value, currency)}</div>
              </Link>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Top open deals */}
        <Panel eyebrow="Largest Open Opportunities" className="lg:col-span-7">
          <div className="divide-y divide-white/5">
            {topDeals.map((deal: Deal) => (
              <Link
                key={deal.id}
                to={`/deals/${deal.id}/show`}
                className="flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {companyById.get(String(deal.company_id))?.name ?? deal.name}
                  </div>
                  <div className="text-[11px] text-[#4a5a70] truncate">
                    {contactName(contactById, deal.contact_ids?.[0], "")}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone="blue">
                    {config.dealStages.find((s) => s.value === deal.stage)?.label ?? deal.stage}
                  </Badge>
                  <span className="text-sm font-bold text-[#c9a84c] w-16 text-right">
                    {formatMoney(Number(deal.amount) || 0, currency)}
                  </span>
                </div>
              </Link>
            ))}
            {topDeals.length === 0 ? <div className="py-4 text-sm text-[#8a9ab0]">No open deals yet.</div> : null}
          </div>
        </Panel>

        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Operational flags */}
          <Panel eyebrow="Operational Flags">
            <FlagRow label="Open deals with no next action" count={missingNextAction.length} unit="deals" tone="red" />
            <FlagRow label={`Stale investors (${STALE_DAYS}+ days quiet)`} count={staleInvestors.length} unit="investors" tone="amber" />
            <FlagRow label="Overdue tasks" count={overdue.length} unit="tasks" tone="amber" />
          </Panel>

          {/* Next milestone */}
          {nextMilestone ? (
            <Panel gold eyebrow="Next Milestone">
              <div className="text-sm font-semibold mb-2">{nextMilestone.goal.title}</div>
              <ProgressBar pct={progressPct(nextMilestone.current, Number(nextMilestone.goal.target_value))} />
              <div className="text-[11px] text-[#8a9ab0] mt-2">
                {formatMetric(nextMilestone.goal.metric, nextMilestone.current, currency)} of{" "}
                {formatMetric(nextMilestone.goal.metric, Number(nextMilestone.goal.target_value), currency)}
                {nextMilestone.goal.owner_label ? ` · Owner: ${nextMilestone.goal.owner_label}` : ""}
                {nextMilestone.goal.due_date ? ` · Due ${formatDay(nextMilestone.goal.due_date)}` : ""}
              </div>
            </Panel>
          ) : null}

          {/* Needs attention */}
          <Panel eyebrow="Needs Attention Today">
            {attentionTasks.length === 0 ? (
              <div className="text-sm text-[#34d399]">Nothing overdue or due today.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {attentionTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="text-[13px] truncate">{task.text}</div>
                      <div className="text-[11px] text-[#4a5a70]">{contactName(contactById, task.contact_id)}</div>
                    </div>
                    <Badge tone={dueBucket(task) === "overdue" ? "red" : "amber"}>
                      {dueBucket(task) === "overdue" ? "Overdue" : "Today"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <Link to={CAPITAL_ROUTES.tasks} className="block mt-3 text-xs font-semibold text-[#c9a84c] hover:underline">
              Open task board →
            </Link>
          </Panel>
        </div>
      </div>
    </OsPage>
  );
};

const FlagRow = ({ label, count, unit, tone }: { label: string; count: number; unit: string; tone: "red" | "amber" }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-[13px] text-[#8a9ab0]">{label}</span>
    <Badge tone={count ? tone : "green"}>
      {count} {unit}
    </Badge>
  </div>
);
