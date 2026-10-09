import type { NsMessages } from "../../core";

// Brand promotions in the Client Area and the app: the dashboard's hero carousel, Events & updates and the updates pages.
const updates: NsMessages<"updates"> = {
  title: "События и новости",
  subtitle: "События, объявления и новости от команды",
  all: "Все новости",
  "filter.events": "События",
  "filter.posts": "Объявления",
  "kind.event": "Событие",
  "kind.post": "Объявление",
  "state.upcoming": "Скоро",
  "state.live": "Идёт сейчас",
  "state.ended": "Завершено",
  when: "Когда",
  where: "Где",
  online: "Онлайн",
  join: "Присоединиться онлайн",
  readMore: "Читать далее",
  published: "Опубликовано {date}",
  "empty.title": "Пока нет новостей",
  "empty.text": "Новые события и объявления появятся здесь.",
  "notFound.title": "Эта публикация недоступна",
  "notFound.text": "Возможно, она завершилась или была удалена.",
  "hero.label": "Рекомендуем",
  "hero.slide": "Слайд {n} из {total}",
  "hero.previous": "Предыдущий слайд",
  "hero.next": "Следующий слайд",
  "hero.pause": "Остановить показ",
  "hero.play": "Запустить показ",
  "hero.dismiss": "Скрыть этот баннер",
};
export default updates;
