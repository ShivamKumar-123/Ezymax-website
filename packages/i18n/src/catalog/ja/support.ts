import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "サポート",
  "page.subtitle": "Ezymex AIとチャットしてすぐに回答を得られます。いつでも担当者への切り替えを依頼でき、チームがこれまでの会話を引き継いで対応します。",
  "email.prefer": "メールをご希望ですか？",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "<email>{email}</email>からメールを送信し、クライアントID <id>{id}</id>を記載してください。",
  "email.write": "サポートにメールする",
  "email.copyId": "クライアントIDをコピー",
  clientId: "クライアントID",
  notice: "チームからの返信は通知ベルにも表示され、ご不在時にはメールでお知らせします。この設定はプロフィール → 通知で変更できます。",
  "toast.copied": "{what}をコピーしました",
  "toast.copyFailed": "コピーできませんでした。手動で選択してください",

  // Conversation status
  "status.bot": "AIアシスタント",
  "status.waiting": "待機中",
  "status.assigned": "担当者対応中",
  "status.resolved": "終了",

  // Conversation history
  "history.title": "お問い合わせ履歴",
  "history.subtitle": "会話記録はクライアントエリアに保存されます",
  "history.emptyTitle": "会話はまだありません",
  "history.emptyText": "チャットで質問すると、ここに表示されます。",
  conversation: "会話",
  "toast.openFailed": "会話を開けませんでした",

  // Floating button
  "launcher.open": "サポートチャットを開く",
  "launcher.close": "サポートチャットを閉じる",

  // Chat
  you: "あなた",
  agent: "担当者",
  // Fallback name for a team member without a name
  supportName: "サポート",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "本人確認はどのように行いますか？",
  "quick.deposit": "USDTの入金方法を教えてください",
  "quick.withdrawal": "出金はいつ着金しますか？",
  "quick.stopOut": "ストップアウトとは何ですか？",
  "header.supportTeam": "サポートチーム",
  "header.agentSub": "クライアントサポート · Ezymex",
  "header.connecting": "担当者におつなぎしています…",
  "header.replySoon": "まもなくチームがこちらで返信します",
  "header.helpCentre": "ヘルプセンターの回答 · いつでも担当者に切り替え可能",
  "header.instant": "即時回答 · いつでも担当者に切り替え可能",
  "chip.liveAgent": "担当者",
  "menu.aria": "チャットオプション",
  "menu.talkToPerson": "担当者と話す",
  "menu.endChat": "チャットを終了",
  "menu.newChat": "新しいチャットを開始",
  closeChat: "チャットを閉じる",
  unavailable: "現在チャットはご利用いただけません。",
  greeting: "{name}様、こんにちは。",
  "csat.question": "このチャットはいかがでしたか？",
  "csat.stars": { other: "{count}つ星" },
  "csat.placeholder": "ご意見があればご記入ください（任意）",
  "csat.send": "評価を送信",
  "csat.rated": "このチャットを{rating}/5と評価しました",
  "composer.attach": "ファイルを添付",
  "composer.messageTo": "{name}へのメッセージ…",
  "composer.newChat": "新しいチャットを開始…",
  "composer.ask": "{name}に何でも質問…",
  "composer.aria": "メッセージ",
  disclaimer: "{name}は誤った回答をする場合があり、投資助言は一切行いません。チャットは品質向上のため記録されます。",
  "toast.chattingWith": "{name}とチャット中です",
  "toast.inQueue": "担当者の順番待ちです",
  "toast.notSent": "メッセージを送信できませんでした",
  "toast.teamUnreachable": "チームに接続できませんでした",
  "toast.endFailed": "チャットを終了できませんでした",
  "toast.rateFailed": "評価を保存できませんでした",
  "toast.thanks": "フィードバックをありがとうございます",
  "toast.fileTooLarge": "ファイルサイズが大きすぎます",
  "toast.fileTooLargeText": "ファイルは最大{mb} MBまでです。",
  "toast.unsupported": "非対応のファイル",
  "toast.unsupportedText": "画像（PNG、JPG、GIF、WEBP）またはPDFを添付してください。",
  "toast.uploadFailed": "アップロードに失敗しました",
  "error.uploadFailed": "アップロードに失敗しました。",
};
export default support;
