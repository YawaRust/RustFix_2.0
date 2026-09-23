/**
 * Лёгкий режим портатива — БЕЗ Tauri / Rust / компиляции.
 *
 * Портативная сборка = ZIP-папка: index.html открывается через
 * RustFix.cmd в режиме Edge --app (окно 1в1 как у .exe).
 * Лаунчер дописывает ?app=1 — по нему интерфейс понимает,
 * что это «окно приложения», а не обычная вкладка браузера.
 *
 * Сборка на GitHub теперь ~1–2 минуты: только npm + zip.
 */

export const isApp: boolean =
  typeof window !== "undefined" &&
  (window.location.search.includes("app=1") ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: window)").matches));

/** В портативе без backend билд вводит пользователь (winver) */
export async function detectBuild(): Promise<string | null> {
  return null;
}

/**
 * «Запуск» в портативе: скачиваем .ps1 и объясняем один шаг —
 * клик правой кнопкой → «Запуск от имени администратора».
 * Так прозрачно и безопасно: скрипт всегда виден до запуска.
 */
export async function runScript(name: string, content: string): Promise<string> {
  const blob = new Blob(["﻿" + content], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".ps1";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return (
    "Файл " +
    name +
    ".ps1 сохранён в «Загрузки». Кликните по нему правой кнопкой → «Запуск с помощью PowerShell от имени администратора» и подтвердите UAC."
  );
}
