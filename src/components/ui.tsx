import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import plate from "../assets/plate.jpg";

export function Mark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="RustFix">
      <path
        d="M24 2.6 43.4 13.3v21.4L24 45.4 4.6 34.7V13.3L24 2.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M14 17.5 20.6 24 14 30.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
      <path
        d="M25 30.5h9.5"
        stroke="#c75b24"
        strokeWidth="3"
        strokeLinecap="square"
      />
      <path
        d="M25 21.6h7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function Screws() {
  const dot = "absolute h-2 w-2 rounded-full bg-steel-800 ring-1 ring-black/70";
  return (
    <>
      <span className={`${dot} left-1.5 top-1.5`} />
      <span className={`${dot} right-1.5 top-1.5`} />
      <span className={`${dot} bottom-1.5 left-1.5`} />
      <span className={`${dot} bottom-1.5 right-1.5`} />
    </>
  );
}

export function Panel({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative border border-line bg-steel-900 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.13] mix-blend-overlay"
        style={{ backgroundImage: `url(${plate})`, backgroundSize: "460px" }}
      />
      <Screws />
      <div className="relative">{children}</div>
    </section>
  );
}

export function Head({
  num,
  title,
  sub,
  tone = "rust",
}: {
  num: string;
  title: string;
  sub?: string;
  tone?: "rust" | "stamp" | "patina";
}) {
  const c =
    tone === "stamp" ? "text-amber" : tone === "patina" ? "text-patina" : "text-rust";
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-4">
        <span className={`font-mono text-xs tabular ${c}`}>{num}</span>
        <h2 className="engraved font-display text-2xl font-medium uppercase tracking-[0.18em] sm:text-3xl">
          {title}
        </h2>
        <span className="h-px flex-1 bg-line" />
      </div>
      {sub && (
        <p className="mt-2 max-w-2xl pl-9 text-sm leading-relaxed text-ash">{sub}</p>
      )}
    </div>
  );
}

export function Led({
  on = true,
  tone = "patina",
  label,
}: {
  on?: boolean;
  tone?: "patina" | "rust" | "amber" | "ash";
  label?: string;
}) {
  const map = {
    patina: "#4fa89a",
    rust: "#e8823f",
    amber: "#e0a32e",
    ash: "#3a312a",
  } as const;
  const reduce = useReducedMotion();
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="relative inline-block h-2 w-2 rounded-full"
        style={{
          background: map[tone],
          boxShadow: on ? `0 0 7px ${map[tone]}` : "inset 0 1px 2px #000",
        }}
      >
        {on && !reduce && (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-60"
            style={{ background: map[tone], animationDuration: "2.4s" }}
          />
        )}
      </span>
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">
          {label}
        </span>
      )}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  desc,
  code,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
  code?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`group flex w-full items-start gap-4 border p-4 text-left transition-colors duration-150 ${
        checked
          ? "border-rust/70 bg-rust/10"
          : "border-line bg-steel-850/60 hover:border-ash/50 hover:bg-steel-850"
      }`}
    >
      <span
        className={`mt-0.5 relative h-6 w-11 shrink-0 border transition-colors duration-150 ${
          checked ? "border-rust bg-rust/25" : "border-line bg-steel-950"
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 transition-all duration-200 ${
            checked ? "left-[26px] bg-rust-bright" : "left-[3px] bg-ash/60"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-sm uppercase tracking-[0.14em]">
            {label}
          </span>
          {code && (
            <span className="font-mono text-[10px] text-rust-bright">{code}</span>
          )}
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-ash">{desc}</span>
      </span>
    </button>
  );
}

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; t: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ash">
        {label}
      </div>
      <div className="flex flex-wrap border border-line bg-steel-950">
        {options.map((o, i) => {
          const on = o.v === value;
          return (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => onChange(o.v)}
              className={`flex-1 px-3 py-2.5 font-display text-[13px] uppercase tracking-[0.12em] transition-colors duration-150 ${
                i > 0 ? "border-l border-line" : ""
              } ${
                on
                  ? "bg-rust text-white"
                  : "text-ash hover:bg-steel-850 hover:text-bone"
              }`}
            >
              {o.t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Btn({
  children,
  onClick,
  href,
  tone = "ghost",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "solid" | "ghost" | "patina";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 border px-4 py-2.5 font-display text-[13px] uppercase tracking-[0.16em] transition-all duration-150";
  const tones = {
    solid: "border-rust bg-rust text-white hover:bg-rust-bright hover:border-rust-bright",
    patina: "border-patina/70 text-patina hover:bg-patina/15",
    ghost: "border-line text-bone hover:border-rust hover:text-rust-bright",
  } as const;
  const cls = `${base} ${tones[tone]} ${className}`;
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={cls}>
        {children}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function Enter({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 3 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="group inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-patina hover:text-bone"
    >
      <span className="h-px w-6 bg-patina transition-all group-hover:w-10 group-hover:bg-rust-bright" />
      {children}
    </motion.button>
  );
}
