import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mark } from "./ui";
import { TARGET } from "../data";

type WinState = "open" | "min" | "closed";
type DemoTab = "diag" | "remove" | "control" | "run";
type Uac = "hidden" | "ask" | "work" | "done";

const DEMO_KB = [
  { kb: "KB5062553", t: "Накопительное · июль 2025", s: "842 МБ" },
  { kb: "KB5060842", t: "Накопительное · июнь 2025", s: "798 МБ" },
  { kb: "KB5044380", t: "Платформа Defender", s: "118 МБ" },
];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  return `${hh}:${mm} · ${dd}.${mo}`;
}

function Shield({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        d="M24 3 41 10v13c0 10.5-7.2 18.4-17 22C14.2 41.4 7 33.5 7 23V10L24 3Z"
        fill="#2f7cd1"
        stroke="#1c5aa0"
        strokeWidth="2"
      />
      <path
        d="M24 3 41 10v13c0 10.5-7.2 18.4-17 22C14.2 41.4 7 33.5 7 23V10L24 3Z"
        fill="none"
        stroke="#9cc4ee"
        strokeWidth="1"
        opacity="0.7"
      />
      <path d="M15 24.5h9v9h-9z M25 15h8v18h-8z" fill="#f7c948" stroke="#a67c00" />
    </svg>
  );
}

export default function DemoPreview() {
  const [win, setWin] = useState<WinState>("open");
  const [max, setMax] = useState(false);
  const [tab, setTab] = useState<DemoTab>("diag");
  const [kb, setKb] = useState<string[]>(["KB5062553", "KB5044380"]);
  const [uac, setUac] = useState<Uac>("hidden");
  const [progress, setProgress] = useState(0);
  const clock = useClock();

  // анимация прогресса UAC
  useEffect(() => {
    if (uac !== "work") return;
    setProgress(0);
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(id);
          setTimeout(() => setUac("done"), 250);
          return 100;
        }
        return p + 8;
      });
    }, 120);
    return () => clearInterval(id);
  }, [uac]);

  const toggleKb = (k: string) =>
    setKb((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const tabs: { v: DemoTab; t: string }[] = [
    { v: "diag", t: "01 · Проверка" },
    { v: "remove", t: "02 · Удаление" },
    { v: "control", t: "03 · Пауза" },
    { v: "run", t: "Консоль" },
  ];

  return (
    <div>
      {/* ─── рабочий стол ─── */}
      <div className="relative overflow-hidden rounded-lg border border-line bg-[#0b0d12]">
        {/* обои */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 420px at 78% 20%, rgba(199,91,36,.28), transparent 60%), radial-gradient(700px 500px at 12% 85%, rgba(47,124,209,.16), transparent 60%), linear-gradient(160deg, #141a24 0%, #0b0d12 55%, #131010 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(closest-side at 50% 40%, black, transparent)",
            WebkitMaskImage:
              "radial-gradient(closest-side at 50% 40%, black, transparent)",
          }}
        />

        <div className="relative flex min-h-[560px] flex-col p-3 sm:min-h-[600px] sm:p-5">
          {/* ярлыки */}
          <div className="pointer-events-auto absolute left-3 top-3 flex flex-col gap-4 sm:left-5 sm:top-5">
            {[
              {
                t: "Этот компьютер",
                icon: (
                  <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/25 bg-white/10">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                      <rect x="3" y="4" width="18" height="12" rx="1" fill="none" stroke="#9cc4ee" strokeWidth="1.6" />
                      <path d="M9 20h6M12 16v4" stroke="#9cc4ee" strokeWidth="1.6" />
                      <rect x="5.5" y="6.5" width="13" height="7" fill="#2f7cd1" opacity="0.55" />
                    </svg>
                  </span>
                ),
              },
              {
                t: "Корзина",
                icon: (
                  <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/25 bg-white/10">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                      <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" fill="none" stroke="#c9c9c9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 11v6M14 11v6" stroke="#c9c9c9" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                ),
              },
            ].map((d) => (
              <div key={d.t} className="flex w-16 flex-col items-center gap-1">
                {d.icon}
                <span className="text-center text-[10px] leading-tight text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">
                  {d.t}
                </span>
              </div>
            ))}
            <button
              type="button"
              onDoubleClick={() => {
                setWin("open");
                setUac("hidden");
              }}
              onClick={() => win === "closed" && setWin("open")}
              title="Двойной клик — открыть"
              className="flex w-16 flex-col items-center gap-1 rounded p-1 hover:bg-white/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-rust/70 bg-rust/25 text-bone">
                <Mark className="h-6 w-6" />
              </span>
              <span className="text-center text-[10px] leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">
                RustFix
              </span>
            </button>
          </div>

          {/* ─── окно приложения ─── */}
          <div className="flex flex-1 items-center justify-center py-2 pl-16 sm:pl-20">
            <AnimatePresence>
              {win === "open" && (
                <motion.div
                  initial={{ opacity: 0, y: 26, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 26, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  className={`flex w-full flex-col overflow-hidden rounded-lg border border-white/15 bg-steel-950 shadow-[0_30px_80px_rgba(0,0,0,.65)] ${
                    max ? "max-w-full" : "max-w-[760px]"
                  }`}
                >
                  {/* титулбар Windows 11 */}
                  <div className="flex h-10 shrink-0 items-center gap-2 bg-[#1c1f26] pl-3">
                    <span className="text-bone">
                      <Mark className="h-5 w-5" />
                    </span>
                    <span className="truncate font-body text-[12px] text-white/85">
                      RustFix by yawaside — Windows 11 24H2 · {TARGET.full}
                    </span>
                    <span className="ml-auto flex h-full items-stretch">
                      <button
                        type="button"
                        aria-label="Свернуть"
                        onClick={() => setWin("min")}
                        className="flex w-11 items-center justify-center text-white/75 hover:bg-white/10"
                      >
                        —
                      </button>
                      <button
                        type="button"
                        aria-label="Развернуть"
                        onClick={() => setMax((v) => !v)}
                        className="flex w-11 items-center justify-center text-white/75 hover:bg-white/10"
                      >
                        <span className="block h-3 w-3 rounded-[2px] border border-current" />
                      </button>
                      <button
                        type="button"
                        aria-label="Закрыть"
                        onClick={() => setWin("closed")}
                        className="flex w-11 items-center justify-center rounded-tr-lg text-white/85 hover:bg-[#c42b1c] hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  </div>

                  {/* мини-приложение */}
                  <div className="border-t border-rust/40 bg-steel-950">
                    {/* мини-шапка */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 pt-3">
                      <span className="font-display text-xl font-bold uppercase leading-none">
                        <span className="text-bone">Rust</span>
                        <span className="text-rust">Fix</span>
                      </span>
                      <span className="font-mono text-[10px] text-patina">by yawaside</span>
                      <span className="ml-auto border border-patina/50 bg-patina/10 px-2 py-0.5 font-mono text-[10px] text-patina">
                        эталон {TARGET.full}
                      </span>
                    </div>

                    {/* мини-вкладки */}
                    <div className="flex border-y border-line bg-steel-900">
                      {tabs.map((t) => (
                        <button
                          key={t.v}
                          type="button"
                          onClick={() => setTab(t.v)}
                          className={`flex-1 px-1 py-2 font-display text-[10px] uppercase tracking-[0.08em] transition-colors sm:text-[11px] ${
                            tab === t.v
                              ? "bg-rust text-white"
                              : "text-ash hover:bg-steel-850 hover:text-bone"
                          }`}
                        >
                          {t.t}
                        </button>
                      ))}
                    </div>

                    <div className="min-h-[218px] px-4 py-3">
                      {tab === "diag" && (
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                              текущая сборка · определено из winver
                            </div>
                            <div className="tabular font-mono text-3xl font-bold text-bone">
                              26100.4652
                            </div>
                            <div className="mt-1 text-[12px] text-ash">
                              Отстаёт от стабильной на{" "}
                              <span className="font-mono text-amber">4242 UBR</span> —
                              откат не нужен, нужен накопительный пакет.
                            </div>
                          </div>
                          <div
                            className="inline-block -rotate-6 border-[3px] border-[#e07a5f] px-3 py-1.5 text-center"
                            style={{ outline: "1px solid #e07a5f", outlineOffset: 3 }}
                          >
                            <div className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#e07a5f]">
                              Откат не нужен
                            </div>
                            <div className="font-mono text-[9px] text-[#e07a5f]/80">
                              24H2 · {TARGET.full}
                            </div>
                          </div>
                        </div>
                      )}

                      {tab === "remove" && (
                        <div>
                          {DEMO_KB.map((p) => {
                            const on = kb.includes(p.kb);
                            return (
                              <button
                                key={p.kb}
                                type="button"
                                onClick={() => toggleKb(p.kb)}
                                className={`flex w-full items-center gap-2 border-b border-line/60 py-2 text-left last:border-b-0 ${
                                  on ? "bg-rust/10" : ""
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                                    on ? "border-rust bg-rust" : "border-line"
                                  }`}
                                >
                                  {on && (
                                    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5">
                                      <path
                                        d="M1 5.2 3.7 8 9 1.8"
                                        fill="none"
                                        stroke="#fff"
                                        strokeWidth="2"
                                      />
                                    </svg>
                                  )}
                                </span>
                                <span className="font-mono text-[11px] text-rust-bright">
                                  {p.kb}
                                </span>
                                <span className="truncate text-[12px] text-bone">{p.t}</span>
                                <span className="tabular ml-auto font-mono text-[10px] text-ash">
                                  {p.s}
                                </span>
                              </button>
                            );
                          })}
                          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
                            выбрано: <span className="text-bone">{kb.length} шт</span> ·
                            методов: <span className="text-rust-bright">3</span>
                          </div>
                        </div>
                      )}

                      {tab === "control" && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="border border-line bg-steel-900 p-2.5">
                            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                              пауза обновлений
                            </div>
                            <div className="mt-1.5 flex gap-1">
                              {["7 дн", "4 нед", "35 нед"].map((d, i) => (
                                <span
                                  key={d}
                                  className={`flex-1 border px-1 py-1 text-center font-display text-[10px] uppercase ${
                                    i === 1
                                      ? "border-rust bg-rust text-white"
                                      : "border-line text-ash"
                                  }`}
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="border border-line bg-steel-900 p-2.5">
                            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                              блокировки
                            </div>
                            <div className="mt-1.5 space-y-1 text-[11px]">
                              <div className="flex justify-between">
                                <span className="text-bone">Службы wuauserv/UsoSvc</span>
                                <span className="text-rust-bright">выкл</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-bone">Автоперезагрузка</span>
                                <span className="text-patina">запрет</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {tab === "run" && (
                        <div className="border border-line bg-black/60 p-2.5 font-mono text-[10.5px] leading-relaxed">
                          <div className="text-rust-bright">[RustFix] Метод A — wusa … OK</div>
                          <div className="text-rust-bright">[RustFix] Метод B — DISM … OK</div>
                          <div className="text-patina">[RustFix] Все обновления удалены.</div>
                          <div className="text-amber">
                            [RustFix] Не забудьте паузу в разделе 03.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* большая кнопка */}
                    <div className="px-4 pb-3">
                      <button
                        type="button"
                        onClick={() => setUac("ask")}
                        className="flex w-full items-center justify-center gap-2 bg-rust py-2.5 font-display text-[13px] uppercase tracking-[0.16em] text-white transition-colors hover:bg-rust-bright"
                      >
                        <span aria-hidden>▶</span> Выполнить от администратора
                      </button>
                    </div>

                    {/* статусбар */}
                    <div className="flex items-center gap-3 border-t border-line bg-steel-900 px-4 py-1.5 font-mono text-[10px] text-ash">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-patina shadow-[0_0_6px_#4fa89a]" />
                      готов · {TARGET.full}
                      <span className="ml-auto">UTF-8 · админ</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {win !== "open" && (
              <div className="max-w-[420px] rounded-lg border border-white/10 bg-black/55 px-5 py-4 text-center backdrop-blur">
                <div className="font-display text-lg uppercase tracking-[0.12em] text-bone">
                  {win === "min" ? "Окно свёрнуто" : "Окно закрыто"}
                </div>
                <p className="mt-1 text-[12.5px] text-white/70">
                  {win === "min"
                    ? "Кликните по иконке RustFix на панели задач, чтобы развернуть."
                    : "Двойной клик по ярлыку RustFix на рабочем столе — и окно вернётся."}
                </p>
                <button
                  type="button"
                  onClick={() => setWin("open")}
                  className="mt-3 border border-rust bg-rust px-4 py-2 font-display text-[12px] uppercase tracking-[0.14em] text-white hover:bg-rust-bright"
                >
                  Открыть RustFix
                </button>
              </div>
            )}
          </div>

          {/* ─── панель задач ─── */}
          <div className="relative mt-2 flex h-11 items-center gap-2 rounded-md border border-white/10 bg-[#1c1f26]/95 px-3">
            <span className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/10" title="Пуск">
              <span className="grid grid-cols-2 gap-[2px]">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="h-[7px] w-[7px] rounded-[1px] bg-[#2f7cd1]" />
                ))}
              </span>
            </span>
            <span className="hidden h-7 items-center rounded-full border border-white/15 bg-white/5 px-3 text-[11px] text-white/60 sm:flex">
              Поиск
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2f7cd1] text-[11px] font-bold text-white" title="Edge">
              e
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/10" title="Проводник">
              📁
            </span>
            <button
              type="button"
              onClick={() => setWin((w) => (w === "open" ? "min" : "open"))}
              title="RustFix"
              className={`relative flex h-9 w-10 items-center justify-center rounded text-bone hover:bg-white/10 ${
                win === "open" ? "bg-white/10" : ""
              }`}
            >
              <Mark className="h-5 w-5" />
              <span
                className={`absolute bottom-0.5 h-[2px] w-5 rounded ${
                  win === "open" ? "bg-rust-bright" : "bg-white/25"
                }`}
              />
            </button>
            <span className="ml-auto hidden font-mono text-[10px] text-white/60 md:block">
              {win === "open" ? "RustFix — активно" : "RustFix — свёрнуто/закрыто"}
            </span>
            <span className="ml-auto text-right font-mono text-[11px] leading-tight text-white/85 md:ml-0">
              {clock}
            </span>
            <span className="h-6 w-px bg-white/15" title="Показать рабочий стол" />
          </div>
        </div>

        {/* ─── UAC ─── */}
        <AnimatePresence>
          {uac !== "hidden" && win === "open" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 p-4"
              onClick={() => uac === "ask" && setUac("hidden")}
            >
              <motion.div
                initial={{ scale: 0.92, y: 14 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[400px] rounded-md border border-white/20 bg-[#20242c] p-5 shadow-2xl"
              >
                {uac === "ask" && (
                  <>
                    <div className="font-body text-[13px] text-white/90">
                      Разрешить этому приложению вносить изменения на устройстве?
                    </div>
                    <div className="mt-3 flex items-start gap-3">
                      <Shield />
                      <div>
                        <div className="font-body text-[14px] font-semibold text-white">
                          RustFix by yawaside
                        </div>
                        <div className="font-mono text-[11px] text-white/60">
                          Проверенный издатель: yawaside
                        </div>
                        <div className="font-mono text-[11px] text-white/60">
                          Источник: локальный портатив · PowerShell
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setUac("work")}
                        className="border border-[#2f7cd1] bg-[#2f7cd1] py-2 font-body text-[13px] text-white hover:bg-[#3b8be3]"
                      >
                        Да
                      </button>
                      <button
                        type="button"
                        onClick={() => setUac("hidden")}
                        className="border border-white/25 py-2 font-body text-[13px] text-white hover:bg-white/10"
                      >
                        Нет
                      </button>
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-white/45">
                      Так выглядит настоящий запрос прав — скрипт виден до запуска.
                    </div>
                  </>
                )}
                {uac === "work" && (
                  <>
                    <div className="font-body text-[13px] text-white/90">
                      Выполнение: снятие обновлений…
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded bg-white/10">
                      <div
                        className="h-full bg-rust transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="tabular mt-2 font-mono text-[11px] text-white/60">
                      wusa → DISM → зачистка · {progress}%
                    </div>
                  </>
                )}
                {uac === "done" && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-patina/20 text-xl text-patina">
                        ✓
                      </span>
                      <div>
                        <div className="font-body text-[14px] font-semibold text-white">
                          Готово
                        </div>
                        <div className="font-mono text-[11px] text-white/60">
                          Пакеты сняты · точка восстановления создана
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUac("hidden")}
                      className="mt-4 w-full border border-patina/60 bg-patina/15 py-2 font-display text-[12px] uppercase tracking-[0.14em] text-patina hover:bg-patina/25"
                    >
                      Закрыть
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── пояснения ─── */}
      <div className="mt-3 grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            n: "①",
            t: "Окно 1в1",
            d: "Титулбар, кнопки — ▢ ✕, панель задач и UAC. Всё выше кликабельно: сворачивайте, закрывайте, жмите «Выполнить».",
          },
          {
            n: "②",
            t: "Билд и штамп",
            d: "Вкладка «Проверка» сверяет сборку с эталоном " + TARGET.full + " и ставит заключение-штамп.",
          },
          {
            n: "③",
            t: "Одна кнопка",
            d: "«Выполнить от администратора» → запрос UAC → скрипт ведёт сам: точка восстановления, wusa → DISM → зачистка.",
          },
          {
            n: "④",
            t: "Без установки",
            d: "Это портатив: ZIP → RustFix.cmd → окно. Сборка на GitHub занимает ~1–2 минуты, компиляции нет.",
          },
        ].map((c) => (
          <div key={c.n} className="bg-steel-900 px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[12px] text-rust-bright">{c.n}</span>
              <span className="font-display text-[13px] uppercase tracking-[0.12em] text-bone">
                {c.t}
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-snug text-ash">{c.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
