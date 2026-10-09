import type { NsMessages } from "../../core";

// Brand promotions in the Client Area and the app: the dashboard's hero carousel, Events & updates and the updates pages.
const updates: NsMessages<"updates"> = {
  title: "الفعاليات والمستجدات",
  subtitle: "فعاليات وإعلانات وأخبار من الفريق",
  all: "كل المستجدات",
  "filter.events": "الفعاليات",
  "filter.posts": "الإعلانات",
  "kind.event": "فعالية",
  "kind.post": "إعلان",
  "state.upcoming": "قادمة",
  "state.live": "جارية الآن",
  "state.ended": "انتهت",
  when: "الموعد",
  where: "المكان",
  online: "عبر الإنترنت",
  join: "انضم عبر الإنترنت",
  readMore: "اقرأ المزيد",
  published: "نُشر في {date}",
  "empty.title": "لا توجد مستجدات حاليًا",
  "empty.text": "ستظهر الفعاليات والإعلانات الجديدة هنا.",
  "notFound.title": "هذا التحديث غير متاح",
  "notFound.text": "ربما انتهى أو تمت إزالته.",
  "hero.label": "مميز",
  "hero.slide": "الشريحة {n} من {total}",
  "hero.previous": "الشريحة السابقة",
  "hero.next": "الشريحة التالية",
  "hero.pause": "إيقاف العرض مؤقتًا",
  "hero.play": "تشغيل العرض",
  "hero.dismiss": "إخفاء هذا الإعلان",
};
export default updates;
