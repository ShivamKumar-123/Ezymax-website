import type { NsMessages } from "../../core";

// Brand promotions in the Client Area and the app: the dashboard's hero carousel, Events & updates and the updates pages.
const updates: NsMessages<"updates"> = {
  title: "กิจกรรมและข่าวสาร",
  subtitle: "กิจกรรม ประกาศ และข่าวสารจากทีมงาน",
  all: "ข่าวสารทั้งหมด",
  "filter.events": "กิจกรรม",
  "filter.posts": "ประกาศ",
  "kind.event": "กิจกรรม",
  "kind.post": "ประกาศ",
  "state.upcoming": "กำลังจะมาถึง",
  "state.live": "กำลังจัดอยู่",
  "state.ended": "สิ้นสุดแล้ว",
  when: "เมื่อไร",
  where: "ที่ไหน",
  online: "ออนไลน์",
  join: "เข้าร่วมออนไลน์",
  readMore: "อ่านเพิ่มเติม",
  published: "เผยแพร่เมื่อ {date}",
  "empty.title": "ยังไม่มีข่าวสารในตอนนี้",
  "empty.text": "กิจกรรมและประกาศใหม่จะแสดงที่นี่",
  "notFound.title": "ข่าวสารนี้ไม่พร้อมใช้งาน",
  "notFound.text": "อาจสิ้นสุดแล้วหรือถูกนำออก",
  "hero.label": "แนะนำ",
  "hero.slide": "สไลด์ {n} จาก {total}",
  "hero.previous": "สไลด์ก่อนหน้า",
  "hero.next": "สไลด์ถัดไป",
  "hero.pause": "หยุดสไลด์โชว์ชั่วคราว",
  "hero.play": "เล่นสไลด์โชว์",
  "hero.dismiss": "ซ่อนแบนเนอร์นี้",
};
export default updates;
