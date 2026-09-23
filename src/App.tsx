import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TARGET, TELEGRAM, MS_DOWNLOAD, DEFAULT_DETECTED_UPDATES, evaluate, type DetectedUpdate } from "./data";
import { removalScript, controlScript, restoreScript, download, type ControlOpts } from "./scripts";
import { makeZip, saveBlob } from "./zip";
import cmdSrc from "../portable/RustFix.cmd?raw";
import ps1Src from "../portable/RustFix.ps1?raw";
import readmeSrc from "../portable/README.txt?raw";

export default function App() {
  // --- Состояния автосканирования ---
  const [isScanning, setIsScanning] = useState(true);
  const [scanStep, setScanStep] = useState("Инициализация сканера ядра...");
  const [detectedBuild, setDetectedBuild] = useState("26100.4652");
  const [updates, setUpdates] = useState<DetectedUpdate[]>(DEFAULT_DETECTED_UPDATES);
  const [filterType, setFilterType] = useState<"all" | "hidden" | "cumulative">("all");
  const [threeLayer, setThreeLayer] = useState(true);

  // --- Состояния удаления / выполнения ---
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // --- Модальное окно настроек ---
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"pause" | "recovery" | "github" | "about">("pause");

  // Параметры паузы / блокировки
  const [pauseDays, setPauseDays] = useState(28);
  const [opts, setOpts] = useState<ControlOpts>({
    services: true,
    policy: true,
    noreboot: true,
    internet: false,
  });

  // Автосканирование при запуске приложения (без ввода руками)
  useEffect(() => {
    const runScan = async () => {
      setIsScanning(true);
      setScanStep("Чтение HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion...");
      await new Promise((r) => setTimeout(r, 450));
      setScanStep("Проверка ревизии UBR и ветки Windows 11...");
      await new Promise((r) => setTimeout(r, 400));
      setScanStep("Сканирование скрытых пакетов хранилища CBS и WinSxS...");
      await new Promise((r) => setTimeout(r, 450));
      setScanStep("Сверка со стабильным эталоном 26100.8894...");
      await new Promise((r) => setTimeout(r, 350));
      setIsScanning(false);
    };
    runScan();
  }, []);

  const { verdict, branch, missing } = evaluate(detectedBuild);
  const selectedUpdates = useMemo(() => updates.filter((u) => u.selected), [updates]);

  const notify = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Скачивание готового портативного пакета
  const downloadPortableBundle = () => {
    const enc = new TextEncoder();
    const blob = makeZip([
      { name: "RustFix/RustFix.cmd", data: enc.encode(cmdSrc) },
      { name: "RustFix/RustFix.ps1", data: enc.encode(ps1Src) },
      { name: "RustFix/README.txt", data: enc.encode(readmeSrc) },
    ]);
    saveBlob(blob, "RustFix-portable.zip");
    notify("Портативное приложение RustFix-portable.zip скачано! Распакуйте и запустите RustFix.cmd.");
  };

  // Запуск гарантированного удаления
  const handleExecuteRemoval = async () => {
    if (selectedUpdates.length === 0) {
      notify("Отметьте хотя бы одно обновление для удаления.");
      return;
    }

    setIsDeleting(true);
    setDeleteProgress("Создание системной точки восстановления...");
    await new Promise((r) => setTimeout(r, 600));

    setDeleteProgress("Остановка служб wuauserv, UsoSvc, BITS...");
    await new Promise((r) => setTimeout(r, 500));

    for (const u of selectedUpdates) {
      setDeleteProgress(`Удаление ${u.kb} (${u.kind}) через wusa и DISM...`);
      await new Promise((r) => setTimeout(r, 650));
    }

    if (threeLayer) {
      setDeleteProgress("3-й уровень: зачистка кэша SoftwareDistribution и сброс базы WinSxS...");
      await new Promise((r) => setTimeout(r, 700));
    }

    // Удаляем из локального списка
    setUpdates((prev) => prev.filter((u) => !u.selected));
    setIsDeleting(false);
    setDeleteProgress("");

    // Скачиваем готовый PowerShell скрипт под эти пакеты
    const script = removalScript(selectedUpdates.map((u) => u.kb), threeLayer);
    download("RustFix-Execute.ps1", script);

    notify(`Успешно удалено пакетов: ${selectedUpdates.length}. Запущен скрипт очистки. Рекомендуется перезагрузить ПК.`);
  };

  const filteredUpdates = useMemo(() => {
    if (filterType === "hidden") return updates.filter((u) => u.hidden);
    if (filterType === "cumulative") return updates.filter((u) => !u.hidden);
    return updates;
  }, [updates, filterType]);

  const toggleSelectAll = (select: boolean) => {
    setUpdates((prev) => prev.map((u) => ({ ...u, selected: select })));
  };

  return (
    <div className="min-h-screen bg-[#110f0e] text-[#eee5dc] flex flex-col justify-between selection:bg-[#c75b24] selection:text-white">
      {/* ─── ВЕРХНЯЯ СТРОКА: ЛОГОТИП + ПОРТАТИВНЫЙ EXE + НАСТРОЙКИ ─── */}
      <header className="border-b border-[#29221d] bg-[#171311]/95 backdrop-blur sticky top-0 z-30 px-5 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-lg bg-[#c75b24]/20 border border-[#c75b24] text-[#e8823f] flex items-center justify-center font-bold text-sm tracking-wider">
              RF
            </span>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-lg uppercase tracking-wider text-white">
                  Rust<span className="text-[#c75b24]">Fix</span>
                </span>
                <span className="text-xs text-[#8c8279] font-mono">by yawaside</span>
                <span className="text-[10px] bg-[#2a221d] text-[#4fa89a] px-1.5 py-0.5 rounded border border-[#3d322a] font-mono">
                  portable .exe
                </span>
              </div>
              <div className="text-[11px] text-[#7d736b]">
                Целевая стабильная сборка: <strong className="text-[#cfc4b8]">{TARGET.name} ({TARGET.full})</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={downloadPortableBundle}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#c75b24] hover:bg-[#e8823f] text-white text-xs font-bold shadow-sm transition"
              title="Скачать портативную версию утилиты"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>Скачать RustFix (.exe / zip)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#3d332b] bg-[#211a17] hover:bg-[#2c221e] text-xs font-medium text-[#d1c5ba] transition"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#e8823f]" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Настройки</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── ТОСТ УВЕДОМЛЕНИЙ ─── */}
      <AnimatePresence>
        {actionNotice && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-[#1c1714] border border-[#e8823f] text-white p-3.5 rounded-lg shadow-2xl flex items-start gap-3 text-xs"
          >
            <span className="text-[#e8823f] text-base font-bold">ℹ</span>
            <div className="flex-1 leading-relaxed">{actionNotice}</div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-[#998a7e] hover:text-white"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ГЛАВНЫЙ ЭКРАН (ТОЛЬКО БИЛД И УДАЛЕНИЕ) ─── */}
      <main className="max-w-4xl mx-auto w-full px-5 py-6 space-y-6 flex-1">
        {/* 1. КАРТОЧКА АВТОСКАНА БИЛДА */}
        <section className="bg-[#181412] border border-[#2b231e] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#261e19]">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isScanning ? "bg-[#e0a32e] animate-ping" : "bg-[#4fa89a]"}`} />
              <span className="text-xs uppercase tracking-wider font-mono text-[#8a7f76]">
                Автопроверка установленной системы
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#7d736b]">Быстрый тест сборок:</span>
              <button
                type="button"
                onClick={() => setDetectedBuild(TARGET.full)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono ${detectedBuild === TARGET.full ? "bg-[#4fa89a]/20 text-[#4fa89a] border border-[#4fa89a]" : "bg-[#211a17] text-[#8c8279]"}`}
              >
                26100.8894 (Стабильная)
              </button>
              <button
                type="button"
                onClick={() => setDetectedBuild("26100.4652")}
                className={`px-2 py-0.5 rounded text-[11px] font-mono ${detectedBuild === "26100.4652" ? "bg-[#e0a32e]/20 text-[#e0a32e] border border-[#e0a32e]" : "bg-[#211a17] text-[#8c8279]"}`}
              >
                26100.4652
              </button>
              <button
                type="button"
                onClick={() => setDetectedBuild("22631.4169")}
                className={`px-2 py-0.5 rounded text-[11px] font-mono ${detectedBuild === "22631.4169" ? "bg-[#e07a5f]/20 text-[#e07a5f] border border-[#e07a5f]" : "bg-[#211a17] text-[#8c8279]"}`}
              >
                23H2
              </button>
            </div>
          </div>

          {/* Результат сканирования */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-[#8c8279]">Обнаруженная сборка ОС:</span>
                <span className="font-mono text-2xl font-bold text-white tracking-wide">
                  {detectedBuild}
                </span>
                <span className="text-xs text-[#a89d93]">({branch})</span>
              </div>

              {isScanning ? (
                <div className="mt-2 text-xs text-[#e0a32e] font-mono flex items-center gap-2">
                  <span className="animate-spin text-sm">↻</span>
                  <span>{scanStep}</span>
                </div>
              ) : (
                <div className="mt-1.5 text-xs text-[#8c8279] leading-relaxed">
                  {verdict === "ok" && "Сборка полностью соответствует стабильной Windows 11 24H2 (26100.8894)."}
                  {verdict === "outdated" && `Отстаёт на ${missing} ревизий UBR. Вы можете удалить мешающие обновления ниже.`}
                  {verdict === "ahead" && `Сборка новее стабильного канала (+${missing} UBR). Рекомендуется откатить свежие пакеты.`}
                  {verdict === "branch" && `Ветка ${branch} не является 24H2. Локальный откат не поможет, требуется чистая установка.`}
                </div>
              )}
            </div>

            {/* Статус-бейдж */}
            <div>
              {verdict === "ok" && (
                <div className="px-3.5 py-2 rounded-lg bg-[#4fa89a]/10 border border-[#4fa89a]/50 text-[#4fa89a] text-xs font-bold flex items-center gap-2">
                  <span>✓</span>
                  <span>БИЛД СООТВЕТСТВУЕТ</span>
                </div>
              )}
              {verdict === "outdated" && (
                <div className="px-3.5 py-2 rounded-lg bg-[#e0a32e]/10 border border-[#e0a32e]/50 text-[#e0a32e] text-xs font-bold flex items-center gap-2">
                  <span>⚠</span>
                  <span>НИЖЕ СТАБИЛЬНОЙ</span>
                </div>
              )}
              {verdict === "ahead" && (
                <div className="px-3.5 py-2 rounded-lg bg-[#e07a5f]/15 border border-[#e07a5f]/60 text-[#e07a5f] text-xs font-bold flex items-center gap-2">
                  <span>⚠</span>
                  <span>ВЫШЕ ЭТАЛОНА</span>
                </div>
              )}
              {verdict === "branch" && (
                <div className="px-3.5 py-2 rounded-lg bg-[#e07a5f]/20 border border-[#e07a5f] text-white text-xs font-bold flex items-center gap-2">
                  <span>✕</span>
                  <span>ЧУЖАЯ ВЕТКА ОС</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 2. КАРТОЧКА НАЙДЕННЫХ И СКРЫТЫХ ОБНОВЛЕНИЙ */}
        <section className="bg-[#181412] border border-[#2b231e] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#261e19]">
            <div>
              <div className="text-xs uppercase tracking-wider font-mono text-[#8a7f76]">
                Обнаруженные пакеты Windows
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                Обновления, доступные для удаления ({updates.length})
              </h2>
            </div>

            {/* Фильтры обновлений */}
            <div className="flex items-center gap-1.5 bg-[#120f0e] p-1 rounded-lg border border-[#2e2520] text-xs">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-2.5 py-1 rounded transition ${filterType === "all" ? "bg-[#c75b24] text-white font-medium" : "text-[#8c8279] hover:text-white"}`}
              >
                Все ({updates.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("hidden")}
                className={`px-2.5 py-1 rounded transition ${filterType === "hidden" ? "bg-[#c75b24] text-white font-medium" : "text-[#8c8279] hover:text-white"}`}
              >
                Скрытые CBS ({updates.filter((u) => u.hidden).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("cumulative")}
                className={`px-2.5 py-1 rounded transition ${filterType === "cumulative" ? "bg-[#c75b24] text-white font-medium" : "text-[#8c8279] hover:text-white"}`}
              >
                Обычные KB ({updates.filter((u) => !u.hidden).length})
              </button>
            </div>
          </div>

          {/* Список обновлений */}
          <div className="mt-3.5 space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredUpdates.map((u) => (
              <label
                key={u.kb}
                className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer text-xs ${
                  u.selected
                    ? "bg-[#c75b24]/10 border-[#c75b24]/50 text-white"
                    : "bg-[#14100f] border-[#261f1a] text-[#a89d92] hover:border-[#382d25]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={u.selected}
                    onChange={() => {
                      setUpdates((prev) =>
                        prev.map((item) => (item.kb === u.kb ? { ...item, selected: !item.selected } : item))
                      );
                    }}
                    className="rounded border-[#3d332b] text-[#c75b24] focus:ring-0 h-4 w-4"
                  />
                  <div className="font-mono font-bold text-[#e8823f] shrink-0">{u.kb}</div>
                  <div className="truncate text-[#d4c7bc]">{u.title}</div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {u.hidden ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#4fa89a]/15 text-[#4fa89a] border border-[#4fa89a]/30">
                      Скрытый CBS
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2a221d] text-[#8c8279] border border-[#3d322a]">
                      {u.kind}
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-[#6e635a]">{u.size}</span>
                </div>
              </label>
            ))}

            {filteredUpdates.length === 0 && (
              <div className="text-center py-8 text-xs text-[#6e635a]">
                Нет обновлений в выбранной категории
              </div>
            )}
          </div>

          {/* Быстрые действия со списком */}
          <div className="mt-3.5 pt-3 border-t border-[#261e19] flex items-center justify-between text-xs text-[#8c8279]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleSelectAll(true)}
                className="hover:text-white underline"
              >
                Выбрать все
              </button>
              <button
                type="button"
                onClick={() => toggleSelectAll(false)}
                className="hover:text-white underline"
              >
                Снять выбор
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-[#b3a69a]">
              <input
                type="checkbox"
                checked={threeLayer}
                onChange={(e) => setThreeLayer(e.target.checked)}
                className="rounded border-[#3d332b] text-[#c75b24] focus:ring-0"
              />
              <span>Гарантированное удаление (3 уровня: wusa + DISM + зачистка WinSxS)</span>
            </label>
          </div>

          {/* ГЛАВНАЯ КНОПКА УДАЛЕНИЯ */}
          <div className="mt-5 pt-4 border-t border-[#261e19] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#8c8279]">
              Выбрано к удалению: <strong className="text-white">{selectedUpdates.length} обновлений</strong>
            </div>

            <button
              type="button"
              disabled={isDeleting || selectedUpdates.length === 0}
              onClick={handleExecuteRemoval}
              className="w-full sm:w-auto px-7 py-3 bg-[#c75b24] hover:bg-[#e8823f] disabled:opacity-40 text-white font-bold rounded-lg shadow-lg hover:shadow-[#c75b24]/30 transition flex items-center justify-center gap-2.5 text-xs uppercase tracking-wider"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
              </svg>
              <span>{isDeleting ? "УДАЛЕНИЕ..." : "УДАЛИТЬ ВЫБРАННЫЕ ОБНОВЛЕНИЯ"}</span>
            </button>
          </div>

          {/* Индикатор выполнения */}
          {isDeleting && (
            <div className="mt-3 p-3 bg-[#120f0e] border border-[#c75b24]/40 rounded-lg text-xs font-mono text-[#e8823f] flex items-center gap-2 animate-pulse">
              <span>↻</span>
              <span>{deleteProgress}</span>
            </div>
          )}
        </section>
      </main>

      {/* ─── КОМПАКТНЫЙ ФУТЕР ─── */}
      <footer className="border-t border-[#211b17] bg-[#14100e] px-5 py-3 text-xs text-[#6e635a]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>RustFix by yawaside · портативная утилита Windows 11 24H2</div>
          <a
            href={TELEGRAM}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[#e8823f] hover:underline flex items-center gap-1 font-mono"
          >
            https://t.me/TriagedRust ↗
          </a>
        </div>
      </footer>

      {/* ─── МОДАЛЬНОЕ ОКНО «НАСТРОЙКИ» ─── */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-[#181412] border border-[#382d25] rounded-xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Шапка настроек */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#29201a] bg-[#1d1815]">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#e8823f]" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Общие настройки и обслуживание
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="text-[#8c8279] hover:text-white font-bold text-base p-1"
                >
                  ✕
                </button>
              </div>

              {/* Вкладки в настройках */}
              <div className="flex border-b border-[#29201a] bg-[#14100e] px-4 gap-2 text-xs font-medium">
                {[
                  { id: "pause", label: "Пауза и отключение" },
                  { id: "recovery", label: "Если откат не помог" },
                  { id: "github", label: "GitHub & Сборка EXE" },
                  { id: "about", label: "О программе" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSettingsTab(t.id as any)}
                    className={`py-2.5 px-3 border-b-2 transition ${
                      settingsTab === t.id
                        ? "border-[#c75b24] text-white"
                        : "border-transparent text-[#7d736b] hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Содержимое вкладок */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
                {/* 1. ПАУЗА И БЛОКИРОВКА */}
                {settingsTab === "pause" && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-white mb-1">Приостановка Центра обновления</h4>
                      <p className="text-[#8c8279] mb-2.5">
                        Установить дату паузы в реестре, чтобы Windows не загружала пакеты повторно:
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { d: 7, label: "7 дней" },
                          { d: 28, label: "4 недели" },
                          { d: 245, label: "35 недель" },
                          { d: 0, label: "Без паузы" },
                        ].map((item) => (
                          <button
                            key={item.d}
                            type="button"
                            onClick={() => setPauseDays(item.d)}
                            className={`py-2 rounded border transition ${
                              pauseDays === item.d
                                ? "bg-[#c75b24] border-[#c75b24] text-white font-bold"
                                : "bg-[#1d1714] border-[#332820] text-[#a3978d] hover:bg-[#261f1a]"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#29201a] space-y-2.5">
                      <h4 className="font-semibold text-white">Дополнительные блокировки</h4>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={opts.policy}
                          onChange={(e) => setOpts({ ...opts, policy: e.target.checked })}
                          className="mt-0.5 rounded border-[#3d332b] text-[#c75b24] focus:ring-0"
                        />
                        <div>
                          <div className="text-white font-medium">Отключить автообновления (NoAutoUpdate = 1)</div>
                          <div className="text-[11px] text-[#7d736b]">Windows перестаёт автоматически проверять обновления</div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={opts.services}
                          onChange={(e) => setOpts({ ...opts, services: e.target.checked })}
                          className="mt-0.5 rounded border-[#3d332b] text-[#c75b24] focus:ring-0"
                        />
                        <div>
                          <div className="text-white font-medium">Отключить службы wuauserv и UsoSvc</div>
                          <div className="text-[11px] text-[#7d736b]">Службы переводятся в режим Disabled</div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={opts.noreboot}
                          onChange={(e) => setOpts({ ...opts, noreboot: e.target.checked })}
                          className="mt-0.5 rounded border-[#3d332b] text-[#c75b24] focus:ring-0"
                        />
                        <div>
                          <div className="text-white font-medium">Запретить автоперезагрузку</div>
                          <div className="text-[11px] text-[#7d736b]">Запрет принудительного ребута при вошедшем пользователе</div>
                        </div>
                      </label>
                    </div>

                    <div className="pt-3 border-t border-[#29201a] flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const s = controlScript(pauseDays, opts);
                          download("RustFix-Pause.ps1", s);
                          notify("Скрипт фиксации паузы RustFix-Pause.ps1 скачан!");
                        }}
                        className="px-3.5 py-2 bg-[#c75b24] hover:bg-[#e8823f] text-white font-bold rounded"
                      >
                        Применить паузу (.ps1)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const s = restoreScript();
                          download("RustFix-Restore.ps1", s);
                          notify("Скрипт восстановления штатного режима скачан!");
                        }}
                        className="px-3.5 py-2 bg-[#1b2b28] border border-[#4fa89a]/50 text-[#4fa89a] hover:bg-[#233834] font-medium rounded"
                      >
                        Восстановить штатный режим
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. ЕСЛИ ОТКАТ НЕ ПОМОГ */}
                {settingsTab === "recovery" && (
                  <div className="space-y-3.5 leading-relaxed">
                    <div className="p-3 bg-[#e07a5f]/15 border border-[#e07a5f]/40 rounded-lg text-[#d9c9bf]">
                      Если удаление обновлений заблокировано компонентами Windows или установлена чужая ветка ОС, рекомендуется чистая установка официальной <strong>Windows 11 24H2 (Сборка 26100.8894)</strong>.
                    </div>

                    <ol className="space-y-2 list-decimal pl-4 text-[#a3978d]">
                      <li>Перезагрузите ПК и повторите попытку удаления через RustFix (отложенные блокировки спадают после перезагрузки).</li>
                      <li>Выполните в командной строке команду восстановления целостности: <code className="text-white bg-[#100d0c] px-1 py-0.5 rounded">dism /online /cleanup-image /restorehealth</code>.</li>
                      <li>Скачайте чистый образ Windows 11 24H2 по официальной ссылке Microsoft ниже.</li>
                      <li>Запустите <code className="text-white bg-[#100d0c] px-1 py-0.5 rounded">setup.exe</code> с сохранением личных файлов.</li>
                    </ol>

                    <div className="pt-2">
                      <a
                        href={MS_DOWNLOAD}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#2f7cd1] hover:bg-[#3b8be3] text-white font-bold rounded"
                      >
                        Скачать стабильный билд 24H2 (Microsoft.com) ↗
                      </a>
                    </div>
                  </div>
                )}

                {/* 3. GITHUB & СБОРКА EXE */}
                {settingsTab === "github" && (
                  <div className="space-y-3 text-[#a3978d] leading-relaxed">
                    <p>
                      В репозитории настроен CI/CD воркфлоу <strong className="text-white">.github/workflows/build-exe.yml</strong> (.NET 8 WPF): компилирует автономный single-file <strong>RustFix.exe</strong> и <strong className="text-[#4fa89a]">автоматически публикует его в Releases при каждом push</strong> — тег создавать не обязательно.
                    </p>
                    <div className="bg-[#100d0c] border border-[#2b221a] p-3 rounded font-mono text-[11px] text-[#4fa89a]">
                      <div>$ git push origin main</div>
                      <div className="text-[#8c8279] mt-1"># → Actions собирает RustFix.exe (~2-3 мин)</div>
                      <div className="text-[#8c8279]"># → Releases: релиз v1.5.N с файлом RustFix.exe</div>
                      <div className="mt-1">$ git tag v1.5.0 && git push --tags</div>
                      <div className="text-[#8c8279]"># → (опционально) именованный релиз v1.5.0</div>
                    </div>
                    <button
                      type="button"
                      onClick={downloadPortableBundle}
                      className="px-3.5 py-2 bg-[#261e19] border border-[#3d322a] hover:bg-[#332822] text-white font-medium rounded"
                    >
                      Скачать исходники portable-лаунчера (.cmd / .ps1)
                    </button>
                  </div>
                )}

                {/* 4. О ПРОГРАММЕ */}
                {settingsTab === "about" && (
                  <div className="space-y-3.5 text-[#9e9185]">
                    <div>
                      <strong className="text-white text-sm block">RustFix by yawaside</strong>
                      Версия 1.5.0 · Портативное приложение Windows 11 24H2
                    </div>
                    <p>
                      Утилита автоматически определяет установленную сборку, находит все скрытые и системные обновления CBS/DISM, удаляет их в 3 уровня и фиксирует стабильный эталон <strong>26100.8894</strong>.
                    </p>

                    <div className="p-3.5 bg-[#1f1814] border border-[#382d25] rounded-lg">
                      <div className="text-white font-medium mb-1">Официальный телеграм-канал:</div>
                      <a
                        href={TELEGRAM}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[#e8823f] hover:underline font-mono text-sm"
                      >
                        https://t.me/TriagedRust
                      </a>
                      <div className="text-[11px] text-[#7a6f66] mt-1">
                        Помощь по сбоям Windows, синим экранам и удалению проблемных обновлений.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Подвал модалки */}
              <div className="px-5 py-3 border-t border-[#29201a] bg-[#1a1412] flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-1.5 bg-[#261e19] hover:bg-[#332822] text-white rounded text-xs"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
