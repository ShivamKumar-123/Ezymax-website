/**
 * Back Office · Content · Translations manager.
 * Import via `@kalks/mock/admin-translations`. Exports are prefixed I18N_.
 * Builds on the CNT_ translation rows (same 22 languages) and regroups them
 * into the product namespaces used by the Client Area bundles.
 */
import { CNT_LANGS, CNT_OVERRIDES, CNT_TENANTS, CNT_TRANSLATIONS } from "./admin-growth-content";
import { seeded } from "./rng";

export const I18N_LANGS = CNT_LANGS;
export type I18nLang = (typeof CNT_LANGS)[number]["code"];
export const I18N_TENANTS = CNT_TENANTS;

export const I18N_NAMESPACES = ["common", "dashboard", "wallet", "trading", "emails"] as const;
export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

/** Keys per namespace in the full bundle (the grid shows a working sample). */
export const I18N_NAMESPACE_KEYS: Record<I18nNamespace, number> = { common: 486, dashboard: 612, wallet: 402, trading: 688, emails: 230 };
export const I18N_TOTAL_KEYS = Object.values(I18N_NAMESPACE_KEYS).reduce((s, v) => s + v, 0);

const NS_MAP: Record<string, I18nNamespace> = { navigation: "common", auth: "common", kyc: "common", accounts: "dashboard", wallet: "wallet", trading: "trading", emails: "emails" };

// [key, namespace, ...22 values in CNT_LANGS order: en ar ur hi es pt fr de tr ru zh ja ko id vi th ms fa it pl bn sw]
const EXTRA: [string, I18nNamespace, ...string[]][] = [
  ["common.save", "common", "Save changes", "حفظ التغييرات", "تبدیلیاں محفوظ کریں", "बदलाव सहेजें", "Guardar cambios", "Salvar alterações", "Enregistrer", "Änderungen speichern", "Değişiklikleri kaydet", "Сохранить", "保存更改", "変更を保存", "변경 사항 저장", "Simpan perubahan", "Lưu thay đổi", "บันทึกการเปลี่ยนแปลง", "Simpan perubahan", "ذخیره تغییرات", "Salva modifiche", "Zapisz zmiany", "পরিবর্তন সংরক্ষণ", "Hifadhi mabadiliko"],
  ["common.cancel", "common", "Cancel", "إلغاء", "منسوخ کریں", "रद्द करें", "Cancelar", "Cancelar", "Annuler", "Abbrechen", "İptal", "Отмена", "取消", "キャンセル", "취소", "Batal", "Hủy", "ยกเลิก", "Batal", "لغو", "Annulla", "Anuluj", "বাতিল", "Ghairi"],
  ["dashboard.greeting_evening", "dashboard", "Good evening, {{first_name}}", "مساء الخير يا {{first_name}}", "شام بخیر، {{first_name}}", "शुभ संध्या, {{first_name}}", "Buenas tardes, {{first_name}}", "Boa noite, {{first_name}}", "Bonsoir, {{first_name}}", "Guten Abend, {{first_name}}", "İyi akşamlar, {{first_name}}", "Добрый вечер, {{first_name}}", "晚上好，{{first_name}}", "こんばんは、{{first_name}}さん", "안녕하세요, {{first_name}}님", "Selamat malam, {{first_name}}", "Chào buổi tối, {{first_name}}", "สวัสดีตอนเย็น {{first_name}}", "Selamat petang, {{first_name}}", "عصر بخیر، {{first_name}}", "Buonasera, {{first_name}}", "Dobry wieczór, {{first_name}}", "শুভ সন্ধ্যা, {{first_name}}", "Habari za jioni, {{first_name}}"],
  ["dashboard.total_equity", "dashboard", "Total equity", "إجمالي حقوق الملكية", "کل ایکویٹی", "कुल इक्विटी", "Patrimonio total", "Patrimônio total", "Fonds propres totaux", "Gesamtkapital", "Toplam varlık", "Всего средств", "总净值", "総有効証拠金", "총 자산", "Total ekuitas", "Tổng vốn", "มูลค่าสุทธิรวม", "Jumlah ekuiti", "کل ارزش خالص", "Patrimonio totale", "Łączny kapitał", "মোট ইক্যুইটি", "Jumla ya thamani"],
  ["dashboard.open_positions", "dashboard", "Open positions", "الصفقات المفتوحة", "کھلی پوزیشنز", "खुली पोज़िशन", "Posiciones abiertas", "Posições abertas", "Positions ouvertes", "Offene Positionen", "Açık pozisyonlar", "Открытые позиции", "持仓", "保有ポジション", "보유 포지션", "Posisi terbuka", "Vị thế đang mở", "สถานะที่เปิดอยู่", "Posisi terbuka", "معاملات باز", "Posizioni aperte", "Otwarte pozycje", "খোলা পজিশন", "Nafasi zilizo wazi"],
  ["dashboard.margin_level", "dashboard", "Margin level", "مستوى الهامش", "مارجن لیول", "मार्जिन स्तर", "Nivel de margen", "Nível de margem", "Niveau de marge", "Margin-Level", "Marjin seviyesi", "Уровень маржи", "保证金水平", "証拠金維持率", "증거금 수준", "Level margin", "Mức ký quỹ", "ระดับมาร์จิ้น", "Tahap margin", "سطح مارجین", "Livello di margine", "Poziom depozytu", "মার্জিন লেভেল", "Kiwango cha margin"],
  ["wallet.min_withdrawal", "wallet", "Minimum withdrawal is {{amount}}", "الحد الأدنى للسحب هو {{amount}}", "کم از کم رقم نکلوانا {{amount}} ہے", "न्यूनतम निकासी {{amount}} है", "El retiro mínimo es {{amount}}", "O saque mínimo é {{amount}}", "Le retrait minimum est de {{amount}}", "Mindestauszahlung: {{amount}}", "Minimum çekim tutarı {{amount}}", "Минимальный вывод: {{amount}}", "最低提款额为 {{amount}}", "最低出金額は{{amount}}です", "최소 출금액은 {{amount}}입니다", "Penarikan minimum {{amount}}", "Rút tối thiểu {{amount}}", "ถอนขั้นต่ำ {{amount}}", "Pengeluaran minimum {{amount}}", "حداقل برداشت {{amount}} است", "Il prelievo minimo è {{amount}}", "Minimalna wypłata to {{amount}}", "সর্বনিম্ন উত্তোলন {{amount}}", "Kiwango cha chini cha kutoa ni {{amount}}"],
  ["trading.close_all", "trading", "Close all positions", "إغلاق جميع الصفقات", "تمام پوزیشنز بند کریں", "सभी पोज़िशन बंद करें", "Cerrar todas las posiciones", "Fechar todas as posições", "Clôturer toutes les positions", "Alle Positionen schließen", "Tüm pozisyonları kapat", "Закрыть все позиции", "全部平仓", "全ポジション決済", "모든 포지션 청산", "Tutup semua posisi", "Đóng tất cả vị thế", "ปิดสถานะทั้งหมด", "Tutup semua posisi", "بستن همه معاملات", "Chiudi tutte le posizioni", "Zamknij wszystkie pozycje", "সব পজিশন বন্ধ করুন", "Funga nafasi zote"],
  ["emails.otp_subject", "emails", "{{otp_code}} is your verification code", "{{otp_code}} هو رمز التحقق الخاص بك", "{{otp_code}} آپ کا تصدیقی کوڈ ہے", "{{otp_code}} आपका सत्यापन कोड है", "{{otp_code}} es tu código de verificación", "{{otp_code}} é o seu código de verificação", "{{otp_code}} est votre code de vérification", "{{otp_code}} ist Ihr Bestätigungscode", "{{otp_code}} doğrulama kodunuzdur", "{{otp_code}} — ваш код подтверждения", "{{otp_code}} 是您的验证码", "{{otp_code}} は確認コードです", "{{otp_code}}은(는) 인증 코드입니다", "{{otp_code}} adalah kode verifikasi Anda", "{{otp_code}} là mã xác minh của bạn", "{{otp_code}} คือรหัสยืนยันของคุณ", "{{otp_code}} ialah kod pengesahan anda", "{{otp_code}} کد تأیید شماست", "{{otp_code}} è il tuo codice di verifica", "{{otp_code}} to Twój kod weryfikacyjny", "{{otp_code}} আপনার যাচাই কোড", "{{otp_code}} ni msimbo wako wa uthibitisho"],
];

export interface I18nRow {
  key: string;
  namespace: I18nNamespace;
  values: Record<string, string | null>; // null = missing
  mt: Record<string, string>; // machine translation suggestion
  updated: string;
}

const LANG_ORDER = CNT_LANGS.map((l) => l.code);
const MISS_P: Record<string, number> = { ur: 0.3, fa: 0.4, bn: 0.5, sw: 0.55, pl: 0.3, th: 0.25, ko: 0.2, ja: 0.15, ms: 0.15, it: 0.12, de: 0.1, fr: 0.08, ru: 0.1, hi: 0.1 };
const r = seeded(7311);

export const I18N_ROWS: I18nRow[] = [
  ...CNT_TRANSLATIONS.map((t) => ({ key: t.key, namespace: NS_MAP[t.namespace] ?? "common", values: t.values, mt: t.mt, updated: t.updated })),
  ...EXTRA.map(([key, namespace, ...vals]) => {
    const values: Record<string, string | null> = {};
    const mt: Record<string, string> = {};
    LANG_ORDER.forEach((code, i) => {
      const v = vals[i]!;
      mt[code] = v;
      values[code] = code !== "en" && r.bool(MISS_P[code] ?? 0.05) ? null : v;
    });
    return { key, namespace, values, mt, updated: `${r.int(1, 23)} Sep 2026` };
  }),
].sort((a, b) => I18N_NAMESPACES.indexOf(a.namespace) - I18N_NAMESPACES.indexOf(b.namespace) || a.key.localeCompare(b.key));

/** Tenant overrides keyed by "key|lang". */
export const I18N_OVERRIDES = CNT_OVERRIDES;

/** Coverage per language across the whole bundle. */
export const I18N_COVERAGE = CNT_LANGS.map((l) => ({
  ...l,
  translated: I18N_TOTAL_KEYS - l.keysMissing,
  pct: ((I18N_TOTAL_KEYS - l.keysMissing) / I18N_TOTAL_KEYS) * 100,
}));
