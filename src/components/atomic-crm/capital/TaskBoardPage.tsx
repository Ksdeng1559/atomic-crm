/**
 * Capital Raise OS — Task Board page (route: /task-board).
 *
 * One place to see every investor follow-up, grouped by urgency
 * (Overdue → Today → Next 7 days → Later). Ticking a task marks it done in
 * the CRM; new tasks are created with Atomic CRM's own "Add task" dialog,
 * so they appear on contact pages and the standard dashboard as well.
 */
import { Circle, CircleCheck } from "lucide-react";
import { useNotify, useUpdate } from "ra-core";
import { useState } from "react";
import { Link } from "react-router";

import type { Task } from "../types";
import { AddTask } from "../tasks/AddTask";
import { DUE_BUCKET_LABELS, type DueBucket, dueBucket, formatDay, logCapital } from "./capitalMetrics";
import { Badge, KpiCard, OsLoading, OsPage, Panel } from "./osUi";
import type { Tone } from "./osUi";
import { contactName, useCapitalData } from "./useCapitalData";

type Filter = "open" | "overdue" | "today" | "week" | "done" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "All open" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "done", label: "Done" },
  { value: "all", label: "Everything" },
];

/** Order the sections appear in when showing several buckets. */
const BUCKET_ORDER: DueBucket[] = ["overdue", "today", "week", "later", "none", "done"];

const BUCKET_TONE: Record<DueBucket, Tone> = {
  overdue: "red",
  today: "amber",
  week: "gold",
  later: "blue",
  none: "muted",
  done: "green",
};

const matchesFilter = (bucket: DueBucket, filter: Filter) => {
  if (filter === "all") return true;
  if (filter === "open") return bucket !== "done";
  return bucket === filter;
};

export const TaskBoardPage = () => {
  const data = useCapitalData();
  const { config, tasks, contactById } = data;
  const [filter, setFilter] = useState<Filter>("open");
  const [update] = useUpdate();
  const notify = useNotify();

  if (data.isPending) {
    return (
      <OsPage eyebrow="Capital Raise OS" title="Task Board">
        <OsLoading />
      </OsPage>
    );
  }

  const withBucket = tasks.map((task) => ({ task, bucket: dueBucket(task) }));
  const count = (bucket: DueBucket) => withBucket.filter((t) => t.bucket === bucket).length;
  const visible = withBucket.filter(({ bucket }) => matchesFilter(bucket, filter));

  const typeLabel = (type: string) =>
    config.taskTypes.find((t) => t.value === type)?.label ?? (type && type !== "none" ? type : "");

  /** Toggle done/undone. Marking done stamps today's date, undo clears it. */
  const toggleDone = (task: Task) => {
    const done_date = task.done_date ? null : new Date().toISOString();
    logCapital("toggle task", { id: task.id, done_date });
    update(
      "tasks",
      { id: task.id, data: { done_date }, previousData: task },
      {
        onSuccess: () => notify(done_date ? "Task completed" : "Task reopened"),
        onError: (error) => {
          logCapital("toggle task failed", error);
          notify("Could not update task", { type: "error" });
        },
      },
    );
  };

  return (
    <OsPage
      eyebrow="Capital Raise OS · Next actions"
      title="Task Board"
      subtitle="Every investor follow-up in one place. A qualified opportunity without a next action is operationally incomplete."
      actions={
        <div className="flex items-center gap-1 rounded-md border border-[#c9a84c]/25 bg-white px-1">
          <span className="text-xs font-semibold text-[#0a0a0a] pl-2">New task</span>
          <AddTask display="icon" selectContact />
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Overdue" value={count("overdue")} tone={count("overdue") ? "red" : "green"} />
        <KpiCard label="Due today" value={count("today")} tone="amber" />
        <KpiCard label="Next 7 days" value={count("week")} tone="gold" />
        <KpiCard label="Completed" value={count("done")} tone="green" />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
              filter === f.value
                ? "bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/30"
                : "bg-white/[0.03] text-[#8a9ab0] border-transparent hover:bg-white/[0.06]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Panel>
          <div className="text-sm text-[#8a9ab0]">No tasks in this view.</div>
        </Panel>
      ) : null}

      <div className="flex flex-col gap-4">
        {BUCKET_ORDER.map((bucket) => {
          const rows = visible.filter((t) => t.bucket === bucket);
          if (rows.length === 0) return null;
          return (
            <Panel key={bucket} eyebrow={`${DUE_BUCKET_LABELS[bucket]} · ${rows.length}`}>
              <div className="divide-y divide-white/5">
                {rows.map(({ task }) => (
                  <div key={task.id} className="flex items-center gap-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleDone(task)}
                      title={task.done_date ? "Mark as not done" : "Mark as done"}
                      className="shrink-0 cursor-pointer"
                    >
                      {task.done_date ? (
                        <CircleCheck className="w-5 h-5 text-[#34d399]" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#4a5a70] hover:text-[#c9a84c]" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] ${task.done_date ? "line-through text-[#4a5a70]" : ""}`}>
                        {task.text}
                      </div>
                      <Link
                        to={`/contacts/${task.contact_id}/show`}
                        className="text-[11px] text-[#6ab0e8] hover:underline"
                      >
                        {contactName(contactById, task.contact_id)}
                      </Link>
                    </div>
                    {typeLabel(task.type) ? <Badge tone="purple">{typeLabel(task.type)}</Badge> : null}
                    <div className="w-28 text-right">
                      <Badge tone={BUCKET_TONE[bucket]}>{formatDay(task.due_date)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </OsPage>
  );
};
