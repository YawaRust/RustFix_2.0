export const TARGET = {
  branch: "24H2",
  name: "Windows 11 24H2",
  build: "26100",
  ubr: "8894",
  full: "26100.8894",
};

export const TELEGRAM = "https://t.me/TriagedRust";
export const MS_DOWNLOAD = "https://www.microsoft.com/ru-ru/software-download/windows11";

export type DetectedUpdate = {
  kb: string;
  title: string;
  kind: "Кумулятивный" | "Скрытый CBS" | "Безопасность" | "Defender" | ".NET";
  date: string;
  size: string;
  hidden: boolean;
  selected: boolean;
};

export const DEFAULT_DETECTED_UPDATES: DetectedUpdate[] = [
  {
    kb: "KB5062553",
    title: "Накопительный пакет обновления Windows 11 24H2 (июль 2025)",
    kind: "Кумулятивный",
    date: "08.07.2025",
    size: "842 МБ",
    hidden: false,
    selected: true,
  },
  {
    kb: "KB5060842",
    title: "Package_for_RollupFix~31bf3856ad364e35 (Скрытый пакет CBS)",
    kind: "Скрытый CBS",
    date: "10.06.2025",
    size: "798 МБ",
    hidden: true,
    selected: true,
  },
  {
    kb: "KB5058499",
    title: "Накопительное обновление системы безопасности 24H2",
    kind: "Безопасность",
    date: "13.05.2025",
    size: "815 МБ",
    hidden: false,
    selected: true,
  },
  {
    kb: "KB5055523",
    title: "Microsoft-Windows-Servicing-Stack-Package (Компонент SSU)",
    kind: "Скрытый CBS",
    date: "08.04.2025",
    size: "145 МБ",
    hidden: true,
    selected: false,
  },
  {
    kb: "KB5051987",
    title: "Накопительное обновление Windows 11 24H2 (февраль 2025)",
    kind: "Кумулятивный",
    date: "11.02.2025",
    size: "742 МБ",
    hidden: false,
    selected: false,
  },
  {
    kb: "KB5044380",
    title: "Обновление платформы безопасности Microsoft Defender",
    kind: "Defender",
    date: "09.07.2025",
    size: "118 МБ",
    hidden: false,
    selected: false,
  },
  {
    kb: "KB5044284",
    title: "Package_for_DotNetFramework_Update (Скрытый WinSxS)",
    kind: "Скрытый CBS",
    date: "08.10.2024",
    size: "310 МБ",
    hidden: true,
    selected: false,
  },
  {
    kb: "KB5056579",
    title: "Накопительное обновление .NET Framework 3.5 / 4.8.1",
    kind: ".NET",
    date: "14.01.2025",
    size: "78 МБ",
    hidden: false,
    selected: false,
  },
];

export type Verdict = "ok" | "outdated" | "ahead" | "branch";

export function evaluate(raw: string): {
  verdict: Verdict;
  branch: string;
  missing: number;
} {
  const s = raw.trim().replace(/\s/g, "");
  const m = s.match(/^(\d{4,5})(?:\.(\d{1,6}))?$/);
  if (!m) return { verdict: "branch", branch: "неизвестная", missing: 0 };
  
  const major = Number(m[1]);
  const ubr = m[2] ? Number(m[2]) : 0;
  
  if (major !== 26100) {
    return { verdict: "branch", branch: major === 22631 ? "23H2" : major === 26200 ? "25H2" : String(major), missing: 0 };
  }
  
  const targetUbr = Number(TARGET.ubr);
  if (ubr === targetUbr) return { verdict: "ok", branch: TARGET.branch, missing: 0 };
  if (ubr < targetUbr) return { verdict: "outdated", branch: TARGET.branch, missing: targetUbr - ubr };
  return { verdict: "ahead", branch: TARGET.branch, missing: ubr - targetUbr };
}
