'use client';

import { useEffect } from 'react';

/**
 * Website translation (kept from the previous site): Google Translate Element driven by the `googtrans` cookie that
 * the language picker sets. The script is only loaded for visitors who picked a language other than English, so
 * English visitors never download it. The list matches the platform's 22 languages (packages/i18n/src/locales.ts).
 */
export const GT_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
  { code: 'ur', label: 'اردو' },
  { code: 'fa', label: 'فارسی' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'sw', label: 'Kiswahili' },
] as const;

export function readLang(): string {
  if (typeof document === 'undefined') return 'en';
  const m = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
  if (!m) return 'en';
  return decodeURIComponent(m[1]).split('/')[2] || 'en';
}

export function setLang(code: string) {
  const value = `/en/${code}`;
  const host = window.location.hostname.replace(/^www\./, '');
  if (code === 'en') {
    // Clear on this host and the parent domain.
    document.cookie = 'googtrans=; path=/; max-age=0';
    document.cookie = `googtrans=; path=/; domain=.${host}; max-age=0`;
  } else {
    document.cookie = `googtrans=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
    document.cookie = `googtrans=${value}; path=/; domain=.${host}; max-age=${60 * 60 * 24 * 365}`;
  }
  window.location.reload();
}

export default function GoogleTranslate() {
  useEffect(() => {
    const lang = readLang();
    if (lang === 'en' || document.getElementById('google-translate-script')) return;
    (window as unknown as Record<string, unknown>).googleTranslateElementInit = () => {
      const g = (window as unknown as { google?: { translate?: { TranslateElement: new (o: object, id: string) => unknown } } })
        .google;
      if (!g?.translate) return;
      new g.translate.TranslateElement(
        { pageLanguage: 'en', includedLanguages: GT_LANGUAGES.map((l) => l.code).join(','), autoDisplay: false },
        'google_translate_element',
      );
    };
    const s = document.createElement('script');
    s.id = 'google-translate-script';
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);

    // Belt and braces: once the hidden widget exists, make sure it is set to the chosen language.
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
      if (select) {
        if (select.value !== lang) {
          select.value = lang;
          select.dispatchEvent(new Event('change'));
        }
        window.clearInterval(id);
      } else if (tries > 25) window.clearInterval(id);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  return <div id="google_translate_element" aria-hidden="true" style={{ display: 'none' }} />;
}
