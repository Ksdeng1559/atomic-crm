/**
 * Capital Raise OS — shared visual building blocks.
 *
 * These reproduce the look of the Urban Mining OS prototype (deep navy
 * surfaces, gold accents) inside Atomic CRM. The colours are fixed on
 * purpose, so the Capital OS pages look the same in light and dark mode.
 * Every page uses these pieces instead of re-declaring styles (DRY).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "gold" | "green" | "amber" | "red" | "blue" | "purple" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  gold: "text-[#c9a84c]",
  green: "text-[#34d399]",
  amber: "text-[#fbbf24]",
  red: "text-[#f87171]",
  blue: "text-[#6ab0e8]",
  purple: "text-[#a78bfa]",
  muted: "text-[#8a9ab0]",
};

const TONE_BADGE: Record<Tone, string> = {
  gold: "bg-[#c9a84c]/10 text-[#c9a84c]",
  green: "bg-[#34d399]/10 text-[#34d399]",
  amber: "bg-[#fbbf24]/10 text-[#fbbf24]",
  red: "bg-[#f87171]/10 text-[#f87171]",
  blue: "bg-[#2d6fa8]/20 text-[#6ab0e8]",
  purple: "bg-[#a78bfa]/10 text-[#a78bfa]",
  muted: "bg-white/5 text-[#8a9ab0]",
};

/** Full-width navy canvas with the gold eyebrow + title header. */
export const OsPage = ({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <div className="mt-2 mb-6 rounded-2xl bg-[#060c14] text-[#e8edf4] p-6 min-h-[70vh]">
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-[#8a9ab0] mt-1 max-w-3xl">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
    {children}
  </div>
);

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#c9a84c] mb-1">
    {children}
  </div>
);

/** Card surface. `gold` adds the gold top-glow border used for key panels. */
export const Panel = ({
  eyebrow,
  gold,
  className,
  children,
}: {
  eyebrow?: string;
  gold?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-xl bg-[#0f1c2e] p-5 border",
      gold ? "border-[#c9a84c]/25" : "border-white/5",
      className,
    )}
  >
    {gold ? (
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
    ) : null}
    {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
    {children}
  </div>
);

/** One headline number with a label and an optional trend line. */
export const KpiCard = ({
  label,
  value,
  sub,
  tone = "muted",
  subTone = "green",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  subTone?: Tone;
}) => (
  <div className="relative rounded-xl bg-[#0f1c2e] border border-white/5 p-4">
    <Eyebrow>{label}</Eyebrow>
    <div
      className={cn(
        "text-2xl font-extrabold leading-tight",
        tone === "muted" ? "text-[#e8edf4]" : TONE_TEXT[tone],
      )}
    >
      {value}
    </div>
    {sub ? (
      <div className={cn("text-[11px] font-semibold mt-1", TONE_TEXT[subTone])}>
        {sub}
      </div>
    ) : null}
    <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl bg-[#c9a84c] opacity-40" />
  </div>
);

export const Badge = ({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap",
      TONE_BADGE[tone],
    )}
  >
    {children}
  </span>
);

/** Thin gold progress bar. */
export const ProgressBar = ({ pct }: { pct: number }) => (
  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
    <div
      className="h-full rounded-full bg-gradient-to-r from-[#7a6230] to-[#c9a84c] transition-all"
      style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
    />
  </div>
);

/** Shared styling for native inputs/selects on the navy background. */
export const osInputClass =
  "w-full rounded-md bg-[#060c14] border border-white/10 px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#4a5a70] focus:outline-none focus:border-[#c9a84c]/50";

/** Gold primary button + ghost button classes. */
export const osButtonClass =
  "inline-flex items-center gap-1.5 rounded-md bg-[#c9a84c] px-3 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#e8c96a] disabled:opacity-50 cursor-pointer";
export const osGhostButtonClass =
  "inline-flex items-center gap-1.5 rounded-md border border-[#c9a84c]/25 px-3 py-1.5 text-xs font-semibold text-[#c9a84c] hover:bg-[#c9a84c]/10 cursor-pointer";

/** Centered placeholder while data loads. */
export const OsLoading = () => (
  <div className="py-16 text-center text-sm text-[#8a9ab0]">Loading…</div>
);
