import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DEFAULT_DETECTED_UPDATES, MS_DOWNLOAD, TARGET, TELEGRAM } from "./data";

type Filter = "all" | "cbs";
type SettingsTab = "updates" | "recovery" | "about";

function releaseRepository(): string | null {
  const configured = String(import.meta.env.VITE_GITHUB_REPOSITORY || "").trim();
  if (/^[\w.-]+\/[\w.-]+$/.test(configured)) return configured;

  // A published GitHub Pages project can infer its own repository.
  const host = window.location.hostname;
  if (!host.endsWith(".github.io")) return null;
  const owner = host.slice(0, -".github.io".length);
  const project = window.location.pathname.split("/").filter(Boolean)[0] || host;
  return /^[\w.-]+$/.test(owner) && /^[\w.-]+$/.test(project)
    ? `${owner}/${project}`
    : null;
}

const repo = releaseRepository();
const exeUrl = repo ? `https://github.com/${repo}/releases/latest/download/RustFix.exe` : null;
const releasesUrl = repo ? `https://github.com/${repo}/releases` : null;
const rows = DEFAULT_DETECTED_UPDATES.map((item) => ({
  ...item,
  removable: !item.title.includes("Servicing-Stack") && !item.title.includes("WinSxS"),
}));

export default function App() {
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("updates");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [pause, setPause] = useState(28);

  const shown = filter === "cbs" ? rows.filter((item) => item.hidden) : rows;

  const toggle = (kb: string) =>
    setSelected((current) =>
      current.includes(kb) ? current.filter((item) => item !== kb) : [...current, kb],
    );

  const inform = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 5500);
  };

  return (
    <div className="min-h-screen bg-[#100e0d] font-body text-[#efe7de]">
      <header className="border-b border-[#342b25] bg-[#181412] px-5 py-4">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center border border-[#c75b24] bg-[#3d2117] font-mono text-xs font-bold text-[#e8823f]">
              RF
            </span>
            <div>
              <div className="font-display text-xl font-medium uppercase tracking-[0.08em]">
                Rust<span className="text-[#e8823f]">Fix</span>
                <span className="ml-2 font-mono text-[11px] font-normal normal-case tracking-normal text-[#9c9088]">
                  by yawaside
                </span>
              </div>
              <div className="font-mono text-[10px] text-[#9c9088]">
                Портативное приложение Windows x64
              </div>
            </div>
          </div>
          <a
            href={exeUrl || "#release"}
            className="inline-flex items-center justify-center bg-[#c75b24] px-5 py-2.5 font-display text-sm font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#e8823f]"
          >
            {exeUrl ? "Скачать RustFix.exe" : "Где скачать RustFix.exe"}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-4 pb-16 pt-8 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#4fa89a]">
              Превью Windows-приложения
            </p>
            <h1 className="mt-2 font-display text-3xl font-medium uppercase tracking-[0.06em] sm:text-4xl">
              Открыл. Увидел. Выбрал.
            </h1>
          </div>
          <p className="max-w-[340px] text-sm leading-relaxed text-[#a3968c]">
            Это демонстрация интерфейса с примерными данными. Только EXE читает
            вашу систему и выполняет удаление.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="border border-[#3a302a] bg-[#181412] shadow-[0_35px_90px_rgba(0,0,0,.45)]"
        >
          <div className="flex h-9 items-center justify-between border-b border-[#342b25] bg-[#211a17] pl-4">
            <span className="font-mono text-[11px] text-[#c9bcb0]">
              RustFix by yawaside - Windows 11 24H2
            </span>
            <div className="flex h-full items-center text-[#9c9088]" aria-hidden="true">
              <span className="grid h-full w-10 place-items-center">_</span>
              <span className="grid h-full w-10 place-items-center">□</span>
              <span className="grid h-full w-10 place-items-center">×</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="font-display text-xl font-medium uppercase tracking-[0.09em]">
                RustFix <span className="font-mono text-[11px] normal-case tracking-normal text-[#4fa89a]">by yawaside</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#9c9088]">Обновления Windows 11</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings(true)}
              className="border border-[#4b3b31] bg-[#29211d] px-4 py-2 text-xs transition-colors hover:border-[#c75b24]"
            >
              Настройки
            </button>
          </div>

          <div className="mx-4 border border-[#3b3029] bg-[#1c1714] p-4 sm:mx-5">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-[#9c9088]">
                  Текущая сборка (пример)
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums">26100.4652</p>
                <p className="mt-1 text-xs text-[#9c9088]">
                  Целевая сборка: {TARGET.full} ({TARGET.branch})
                </p>
              </div>
              <span className="border border-[#b68b37]/55 bg-[#b68b37]/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#e0a32e]">
                Ниже целевой версии
              </span>
            </div>
          </div>

          <div className="px-4 pb-5 pt-5 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-medium uppercase tracking-[0.1em]">
                  Установленные обновления
                </h2>
                <p className="mt-1 text-xs text-[#9c9088]">
                  В EXE список заполняется автоматически из HotFix и CBS.
                </p>
              </div>
              <div className="flex border border-[#3a302a] font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`px-3 py-2 ${filter === "all" ? "bg-[#c75b24] text-white" : "text-[#9c9088] hover:text-white"}`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("cbs")}
                  className={`border-l border-[#3a302a] px-3 py-2 ${filter === "cbs" ? "bg-[#c75b24] text-white" : "text-[#9c9088] hover:text-white"}`}
                >
                  Скрытые CBS
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[286px] overflow-auto border-y border-[#332a24]">
              <AnimatePresence mode="popLayout">
                {shown.map((item) => (
                  <motion.label
                    key={item.kb}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-center gap-3 border-b border-[#302720] px-2 py-3 text-xs last:border-0 ${item.hidden ? "bg-[#201b17]" : ""} ${item.removable ? "cursor-pointer" : "opacity-55"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(item.kb)}
                      disabled={!item.removable}
                      onChange={() => toggle(item.kb)}
                      className="h-4 w-4 shrink-0 accent-[#c75b24]"
                    />
                    <span className="w-[92px] shrink-0 font-mono text-[#e8823f]">{item.kb}</span>
                    <span className="min-w-0 flex-1 truncate" title={item.title}>{item.title}</span>
                    <span className="hidden shrink-0 font-mono text-[10px] text-[#9c9088] sm:block">
                      {item.hidden ? "CBS" : "HotFix"}
                    </span>
                    <span className={`w-[94px] shrink-0 text-right text-[10px] ${item.removable ? "text-[#4fa89a]" : "text-[#9c9088]"}`}>
                      {item.removable ? "Попытка отката" : "Защищён"}
                    </span>
                  </motion.label>
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-[#9c9088]">
                Выбрано: {selected.length} (только пример)
              </span>
              <button
                type="button"
                onClick={() => inform("Это демо. Браузер не удаляет обновления. Скачайте RustFix.exe из GitHub Releases и запустите его в Windows.")}
                className="bg-[#c75b24] px-5 py-2.5 font-display text-sm font-medium uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#e8823f]"
              >
                Удалить выбранные
              </button>
            </div>
          </div>

          <div className="border-t border-[#342b25] bg-[#161210] px-5 py-3 font-mono text-[10px] text-[#9c9088]">
            Превью: данные вымышлены. Реальная проверка запускается автоматически в EXE.
          </div>
        </motion.div>

        <section id="release" className="mt-10 border-t border-[#342b25] pt-7">
          <h2 className="font-display text-xl font-medium uppercase tracking-[0.1em]">
            Настоящий EXE - в GitHub Releases
          </h2>
          <p className="mt-2 max-w-[690px] text-sm leading-relaxed text-[#a3968c]">
            В релиз прикрепляется именно <span className="font-mono text-white">RustFix.exe</span>,
            а не ZIP со скриптами. Скачайте файл, запустите двойным щелчком и подтвердите
            запрос администратора. Приложение само считывает версию и установленные пакеты.
          </p>
          {releasesUrl ? (
            <a
              href={releasesUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex border border-[#c75b24] px-5 py-2.5 font-display text-sm uppercase tracking-[0.1em] text-[#e8823f] hover:bg-[#c75b24] hover:text-white"
            >
              Открыть Releases
            </a>
          ) : (
            <p className="mt-4 border-l-2 border-[#c75b24] pl-4 text-sm text-[#c9bcb0]">
              Ссылка на репозиторий не настроена. Откройте вкладку Releases этого проекта,
              либо задайте <code className="font-mono text-[#e8823f]">VITE_GITHUB_REPOSITORY=owner/repo</code>
              {" "}при сборке страницы. В браузере EXE не создаётся.
            </p>
          )}
          <p className="mt-4 font-mono text-xs text-[#9c9088]">
            Новый тег: git tag v1.5.1 &amp;&amp; git push origin v1.5.1
          </p>
        </section>
      </main>

      <footer className="border-t border-[#342b25] bg-[#181412] px-5 py-4 text-xs text-[#9c9088]">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3">
          <span>RustFix by yawaside · Windows 11 24H2 · цель {TARGET.full}</span>
          <a href={TELEGRAM} target="_blank" rel="noreferrer noopener" className="text-[#e8823f] hover:underline">
            t.me/TriagedRust
          </a>
        </div>
      </footer>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            role="status"
            className="fixed bottom-5 left-1/2 z-50 w-[min(92%,500px)] -translate-x-1/2 border border-[#c75b24] bg-[#211915] p-4 text-sm text-white shadow-2xl"
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settings && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/75 p-4" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettings(false);
          }}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Демо настроек"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-[560px] border border-[#49372c] bg-[#1b1613] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#3a302a] px-5 py-3">
                <span className="font-display text-lg uppercase tracking-[0.09em]">Настройки</span>
                <button type="button" aria-label="Закрыть" onClick={() => setSettings(false)} className="px-2 text-xl text-[#9c9088] hover:text-white">×</button>
              </div>
              <div className="flex flex-wrap border-b border-[#3a302a] px-3 text-xs">
                {([
                  ["updates", "Пауза обновлений"],
                  ["recovery", "Если откат не удался"],
                  ["about", "О программе"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`border-b-2 px-3 py-3 ${tab === key ? "border-[#c75b24] text-white" : "border-transparent text-[#9c9088] hover:text-white"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="min-h-[195px] p-5 text-sm leading-relaxed text-[#c9bcb0]">
                {tab === "updates" && (
                  <>
                    <p>В EXE можно поставить паузу или отключить автообновления через политики Windows.</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {[7, 28, 35].map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setPause(day)}
                          className={`border px-4 py-2 text-xs ${pause === day ? "border-[#c75b24] bg-[#c75b24] text-white" : "border-[#49372c] text-[#b5a79c]"}`}
                        >
                          {day} дней
                        </button>
                      ))}
                    </div>
                    <p className="mt-5 text-xs text-[#9c9088]">Выбор в демо не меняет настройки вашего ПК.</p>
                  </>
                )}
                {tab === "recovery" && (
                  <>
                    <p>Если Windows отказала в откате: сохраните данные, перезагрузитесь, проверьте DISM /RestoreHealth. При необходимости используйте официальный образ Windows 11.</p>
                    <a href={MS_DOWNLOAD} target="_blank" rel="noreferrer noopener" className="mt-5 inline-block text-[#e8823f] underline">
                      Страница загрузки Microsoft
                    </a>
                    <p className="mt-2 text-xs text-[#9c9088]">Наличие образа именно сборки {TARGET.full} на этой странице не гарантируется.</p>
                  </>
                )}
                {tab === "about" && (
                  <>
                    <p className="font-display text-xl text-white">RustFix by yawaside</p>
                    <p className="mt-2">Портативное WPF-приложение для Windows x64. Один EXE, без установщика. Откат пакетов зависит от ограничений самой Windows.</p>
                    <a href={TELEGRAM} target="_blank" rel="noreferrer noopener" className="mt-5 inline-block font-mono text-[#4fa89a] underline">
                      https://t.me/TriagedRust
                    </a>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}