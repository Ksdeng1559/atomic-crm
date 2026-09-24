/**
 * Capital Raise OS — Goals page (route: /goals).
 *
 * Goal → Milestone → Opportunity → Next Action → Task.
 * Each top-level goal (e.g. "Raise $1M") is broken into ordered milestones.
 * Progress for each milestone is calculated live from the deals pipeline
 * (see capitalMetrics.computeMetric), so it moves as deals change stage.
 */
import { Plus, Trash2 } from "lucide-react";
import { useCreate, useDelete, useNotify } from "ra-core";
import { useState } from "react";

import {
  GOAL_METRIC_LABELS,
  type Goal,
  type GoalMetric,
  computeMetric,
  formatDay,
  formatMetric,
  logCapital,
  progressPct,
  toLocalDay,
} from "./capitalMetrics";
import { Badge, OsLoading, OsPage, Panel, ProgressBar, osButtonClass, osGhostButtonClass, osInputClass } from "./osUi";
import type { Tone } from "./osUi";
import { useCapitalData } from "./useCapitalData";

/** Status shown next to each milestone, derived from progress and due date. */
const milestoneStatus = (pct: number, dueDate: string | null): { label: string; tone: Tone } => {
  if (pct >= 100) return { label: "Done", tone: "green" };
  if (dueDate && toLocalDay(dueDate).getTime() < Date.now()) return { label: "Overdue", tone: "red" };
  if (pct === 0) return { label: "Not started", tone: "muted" };
  const daysLeft = dueDate ? (toLocalDay(dueDate).getTime() - Date.now()) / 86_400_000 : Infinity;
  if (daysLeft < 14 && pct < 50) return { label: "At risk", tone: "amber" };
  return { label: "In progress", tone: "gold" };
};

export const GoalsPage = () => {
  const data = useCapitalData();
  const { config, stageOrder, deals, goals } = data;
  const [showForm, setShowForm] = useState(false);
  const [deleteOne] = useDelete();
  const notify = useNotify();

  if (data.isPending) {
    return (
      <OsPage eyebrow="Capital Raise OS" title="Goals & Milestones">
        <OsLoading />
      </OsPage>
    );
  }

  const topGoals = goals.filter((g) => g.parent_id == null);
  const milestonesOf = (goal: Goal) =>
    goals.filter((g) => g.parent_id === goal.id).sort((a, b) => a.position - b.position);

  const handleDelete = (goal: Goal) => {
    if (!window.confirm(`Delete "${goal.title}"? Milestones under it are deleted too.`)) return;
    deleteOne(
      "goals",
      { id: goal.id, previousData: goal },
      {
        onSuccess: () => {
          notify("Goal deleted");
          data.refetchGoals();
        },
        onError: (error) => {
          logCapital("delete goal failed", error);
          notify("Could not delete goal", { type: "error" });
        },
      },
    );
  };

  return (
    <OsPage
      eyebrow="Capital Raise OS · Goal-driven operating model"
      title="Goals & Milestones"
      subtitle="Goal → Milestone → Opportunity → Next Action → Task. Milestone progress updates automatically from the deal pipeline."
      actions={
        <button type="button" className={osButtonClass} onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-3.5 h-3.5" /> {showForm ? "Close" : "Add goal / milestone"}
        </button>
      }
    >
      {showForm ? (
        <GoalForm
          topGoals={topGoals}
          onDone={() => {
            setShowForm(false);
            data.refetchGoals();
          }}
        />
      ) : null}

      {topGoals.length === 0 ? (
        <Panel>
          <div className="text-sm text-[#8a9ab0]">No goals yet. Add your first raise goal above.</div>
        </Panel>
      ) : null}

      <div className="flex flex-col gap-4">
        {topGoals.map((goal) => {
          const current = computeMetric(goal.metric, deals, stageOrder, goal.current_value);
          const pct = progressPct(current, Number(goal.target_value));
          const milestones = milestonesOf(goal);
          return (
            <Panel key={goal.id} gold>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#c9a84c]">Primary goal</div>
                  <div className="text-lg font-bold">{goal.title}</div>
                  <div className="text-[12px] text-[#8a9ab0] mt-0.5">
                    {formatMetric(goal.metric, current, config.currency)} of{" "}
                    {formatMetric(goal.metric, Number(goal.target_value), config.currency)}
                    {goal.owner_label ? ` · Owner: ${goal.owner_label}` : ""}
                    {goal.due_date ? ` · Target date: ${formatDay(goal.due_date)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="gold">{pct}%</Badge>
                  <button type="button" title="Delete goal" onClick={() => handleDelete(goal)} className="text-[#4a5a70] hover:text-[#f87171] cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <ProgressBar pct={pct} />

              <div className="mt-4">
                {milestones.map((m, index) => {
                  const mCurrent = computeMetric(m.metric, deals, stageOrder, m.current_value);
                  const mPct = progressPct(mCurrent, Number(m.target_value));
                  const status = milestoneStatus(mPct, m.due_date);
                  const isLast = index === milestones.length - 1;
                  return (
                    <div key={m.id} className="flex gap-3.5 py-3 border-b border-white/[0.04] last:border-b-0">
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold border ${
                            mPct >= 100
                              ? "bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30"
                              : mPct > 0
                                ? "bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/25"
                                : "bg-white/[0.04] text-[#4a5a70] border-white/10"
                          }`}
                        >
                          {mPct >= 100 ? "✓" : index + 1}
                        </div>
                        {!isLast ? <div className="w-px flex-1 min-h-5 mt-0.5 bg-gradient-to-b from-white/10 to-transparent" /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <div className="text-sm font-semibold">{m.title}</div>
                          <Badge tone={status.tone}>{status.label}</Badge>
                          <span className="text-[11px] text-[#8a9ab0]">
                            {formatMetric(m.metric, mCurrent, config.currency)} of{" "}
                            {formatMetric(m.metric, Number(m.target_value), config.currency)}
                          </span>
                          <button type="button" title="Delete milestone" onClick={() => handleDelete(m)} className="ml-auto text-[#4a5a70] hover:text-[#f87171] cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <ProgressBar pct={mPct} />
                        <div className="text-[11px] text-[#4a5a70] mt-1">
                          {GOAL_METRIC_LABELS[m.metric]}
                          {m.owner_label ? ` · Owner: ${m.owner_label}` : ""}
                          {m.due_date ? ` · Due ${formatDay(m.due_date)}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {milestones.length === 0 ? (
                  <div className="text-sm text-[#8a9ab0] pt-2">No milestones yet — add one to break this goal down.</div>
                ) : null}
              </div>
            </Panel>
          );
        })}
      </div>
    </OsPage>
  );
};

/** Inline form to add a top-level goal or a milestone under an existing goal. */
const GoalForm = ({ topGoals, onDone }: { topGoals: Goal[]; onDone: () => void }) => {
  const [create, { isPending }] = useCreate();
  const notify = useNotify();
  const [form, setForm] = useState({
    parent_id: topGoals[0] ? String(topGoals[0].id) : "",
    title: "",
    metric: "pipeline_value" as GoalMetric,
    target_value: "",
    current_value: "",
    owner_label: "",
    due_date: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    if (!form.title.trim() || !form.target_value) {
      notify("Title and target are required", { type: "warning" });
      return;
    }
    const payload = {
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      title: form.title.trim(),
      metric: form.metric,
      target_value: Number(form.target_value),
      current_value: Number(form.current_value) || 0,
      owner_label: form.owner_label.trim() || null,
      due_date: form.due_date || null,
      position: 100,
    };
    logCapital("create goal", payload);
    create("goals", { data: payload }, {
      onSuccess: () => {
        notify("Saved");
        onDone();
      },
      onError: (error) => {
        logCapital("create goal failed", error);
        notify("Could not save goal", { type: "error" });
      },
    });
  };

  return (
    <Panel eyebrow="New goal or milestone" className="mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-[11px] text-[#8a9ab0]">
          Belongs to
          <select className={osInputClass} value={form.parent_id} onChange={set("parent_id")}>
            <option value="">(New top-level goal)</option>
            {topGoals.map((g) => (
              <option key={g.id} value={String(g.id)}>Milestone of: {g.title}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-[#8a9ab0] md:col-span-2">
          Title
          <input className={osInputClass} value={form.title} onChange={set("title")} placeholder="e.g. Book 10 family-office meetings" />
        </label>
        <label className="text-[11px] text-[#8a9ab0]">
          Measured by
          <select className={osInputClass} value={form.metric} onChange={set("metric")}>
            {Object.entries(GOAL_METRIC_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-[#8a9ab0]">
          Target
          <input className={osInputClass} type="number" value={form.target_value} onChange={set("target_value")} placeholder="e.g. 1000000" />
        </label>
        {form.metric === "manual" ? (
          <label className="text-[11px] text-[#8a9ab0]">
            Current value
            <input className={osInputClass} type="number" value={form.current_value} onChange={set("current_value")} />
          </label>
        ) : null}
        <label className="text-[11px] text-[#8a9ab0]">
          Owner
          <input className={osInputClass} value={form.owner_label} onChange={set("owner_label")} placeholder="e.g. Andy" />
        </label>
        <label className="text-[11px] text-[#8a9ab0]">
          Due date
          <input className={osInputClass} type="date" value={form.due_date} onChange={set("due_date")} />
        </label>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="button" className={osButtonClass} disabled={isPending} onClick={submit}>Save</button>
        <button type="button" className={osGhostButtonClass} onClick={onDone}>Cancel</button>
      </div>
    </Panel>
  );
};
