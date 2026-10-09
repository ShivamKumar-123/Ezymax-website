import type { NsMessages } from "../../core";

// Brand promotions in the Client Area and the app: the dashboard's hero carousel, Events & updates and the updates pages.
const updates: NsMessages<"updates"> = {
  title: "活动与动态",
  subtitle: "来自团队的活动、公告和新闻",
  all: "全部动态",
  "filter.events": "活动",
  "filter.posts": "公告",
  "kind.event": "活动",
  "kind.post": "公告",
  "state.upcoming": "即将开始",
  "state.live": "正在进行",
  "state.ended": "已结束",
  when: "时间",
  where: "地点",
  online: "线上",
  join: "在线参加",
  readMore: "阅读更多",
  published: "发布于 {date}",
  "empty.title": "暂无动态",
  "empty.text": "新的活动和公告会显示在这里。",
  "notFound.title": "此动态不可用",
  "notFound.text": "它可能已结束或已被下架。",
  "hero.label": "精选",
  "hero.slide": "第 {n} 张，共 {total} 张",
  "hero.previous": "上一张",
  "hero.next": "下一张",
  "hero.pause": "暂停轮播",
  "hero.play": "播放轮播",
  "hero.dismiss": "隐藏此横幅",
};
export default updates;
