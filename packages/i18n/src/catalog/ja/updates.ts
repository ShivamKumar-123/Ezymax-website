import type { NsMessages } from "../../core";

// Brand promotions in the Client Area and the app: the dashboard's hero carousel, Events & updates and the updates pages.
const updates: NsMessages<"updates"> = {
  title: "イベントとお知らせ",
  subtitle: "チームからのイベント、お知らせ、ニュース",
  all: "すべてのお知らせ",
  "filter.events": "イベント",
  "filter.posts": "お知らせ",
  "kind.event": "イベント",
  "kind.post": "お知らせ",
  "state.upcoming": "開催予定",
  "state.live": "開催中",
  "state.ended": "終了",
  when: "日時",
  where: "場所",
  online: "オンライン",
  join: "オンラインで参加",
  readMore: "続きを読む",
  published: "{date} 公開",
  "empty.title": "現在お知らせはありません",
  "empty.text": "新しいイベントやお知らせはここに表示されます。",
  "notFound.title": "このお知らせは表示できません",
  "notFound.text": "終了したか、削除された可能性があります。",
  "hero.label": "注目",
  "hero.slide": "スライド {n} / {total}",
  "hero.previous": "前のスライド",
  "hero.next": "次のスライド",
  "hero.pause": "スライドショーを一時停止",
  "hero.play": "スライドショーを再生",
  "hero.dismiss": "このバナーを非表示",
};
export default updates;
