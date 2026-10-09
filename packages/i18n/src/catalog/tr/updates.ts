import type { NsMessages } from "../../core";

// Brand promotions in the Client Area and the app: the dashboard's hero carousel, Events & updates and the updates pages.
const updates: NsMessages<"updates"> = {
  title: "Etkinlikler ve güncellemeler",
  subtitle: "Ekipten etkinlikler, duyurular ve haberler",
  all: "Tüm güncellemeler",
  "filter.events": "Etkinlikler",
  "filter.posts": "Duyurular",
  "kind.event": "Etkinlik",
  "kind.post": "Duyuru",
  "state.upcoming": "Yaklaşan",
  "state.live": "Şu anda sürüyor",
  "state.ended": "Sona erdi",
  when: "Ne zaman",
  where: "Nerede",
  online: "Çevrim içi",
  join: "Çevrim içi katıl",
  readMore: "Devamını oku",
  published: "{date} tarihinde yayımlandı",
  "empty.title": "Şu an güncelleme yok",
  "empty.text": "Yeni etkinlikler ve duyurular burada görünecek.",
  "notFound.title": "Bu güncelleme kullanılamıyor",
  "notFound.text": "Sona ermiş ya da kaldırılmış olabilir.",
  "hero.label": "Öne çıkan",
  "hero.slide": "Slayt {n} / {total}",
  "hero.previous": "Önceki slayt",
  "hero.next": "Sonraki slayt",
  "hero.pause": "Slayt gösterisini duraklat",
  "hero.play": "Slayt gösterisini oynat",
  "hero.dismiss": "Bu banner'ı gizle",
};
export default updates;
