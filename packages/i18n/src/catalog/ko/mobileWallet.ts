import type { NsMessages } from "../../core";

// Kalks 모바일 앱: 지갑 화면 (개요, 입금, 출금, 이체, 내역). 대부분 `wallet`, `common` 네임스페이스를 재사용
// 브랜드 및 네트워크 이름(Kalks, USDT, BEP20, TRC20, BNB Smart Chain, TRON, MetaMask, USD, USC)은 그대로 유지합니다.
const mobileWallet: NsMessages<"mobileWallet"> = {
  // 개요 헤더: 제목 위 작은 대문자 줄 (자산 및 네트워크)
  eyebrow: "USDT · BEP20 · TRC20",
  "balance.available": "사용 가능",
  "balance.otherAssets": "기타 자산",

  // 복사 / 공유 / 붙여넣기
  copyAddress: "주소 복사",
  share: "공유",
  paste: "붙여넣기",
  tokenContract: "토큰 컨트랙트",
  viewOnExplorer: "탐색기에서 보기",
  keep: "유지",

  // 네트워크 선택 (입금 / 출금); {min}은 금액, {count}는 블록 확인 횟수
  "network.depositDetail": "최소 {min} USDT · 확인 {count}회",
  "network.networkFee": "네트워크 수수료 {fee} USDT",
  "network.noNetworkFee": "네트워크 수수료 없음",
  "network.paused": "일시 중지됨",

  // 입금
  "deposit.belowMin": "최소 입금액은 {min} USDT입니다.",
  // {id}는 입금 요청 ID의 앞부분
  "deposit.request": "요청 {id}",
  // 네트워크 경고 위의 배너 제목; {short}는 BEP20 또는 TRC20
  "deposit.onlyUsdt": "USDT {short}만 보내세요",
  "deposit.openWalletApp": "지갑 앱에서 열기",
  "deposit.walletAppHint": "이 USDT 송금이 준비된 상태로 MetaMask 또는 다른 지갑 앱이 열립니다. 승인만 하면 됩니다.",
  "deposit.noWalletApp": "이 휴대폰에는 이를 열 수 있는 지갑 앱이 없습니다. 주소를 복사하거나 QR 코드를 스캔하세요.",
  "deposit.hashInvalid": "트랜잭션 해시는 64자(0–9, a–f)이며 0x는 있어도 없어도 됩니다.",
  "deposit.submitHash": "트랜잭션 제출",
  "deposit.sentHelp": "지갑이나 거래소에서 트랜잭션 해시를 붙여 넣으세요. 네트워크에서 확인한 후 자동으로 입금 처리합니다.",
  "deposit.expiredHelp": "이 요청은 만료되었습니다. 이미 USDT를 보냈다면 아래에 트랜잭션 해시를 제출하고, 그렇지 않다면 새 입금을 시작하세요.",
  // 입금된 큰 금액 아래; {currency}는 USDT
  "deposit.creditedBody": "{currency}(으)로 지갑에 입금되었습니다",
  // 휴대폰에서의 입금 방법 (2, 3단계; 1, 4단계는 Client Area와 공유)
  "how.sendTitle": "지갑 또는 거래소에서 송금",
  "how.sendText": "주소를 복사하거나 QR 코드를 스캔하세요. BNB Chain에서는 한 번 탭하면 송금이 준비된 상태로 MetaMask가 열립니다.",
  "how.hashTitle": "트랜잭션 해시 붙여 넣기",
  "how.hashText": "네트워크에서 확인한 후 BNB Chain에서 {bsc}회, TRON에서 {tron}회 확인되면 입금 처리합니다.",

  // 출금
  "withdraw.available": "출금 가능 금액",
  "withdraw.belowMin": "최소 출금액은 {min} USDT입니다.",
  "withdraw.aboveMax": "1회 최대 출금액은 {max} USDT입니다.",
  "withdraw.paused": "현재 출금이 일시 중지되었습니다. 나중에 다시 시도하거나 고객 지원팀에 문의하세요.",
  "withdraw.cancelAction": "출금 취소",
  "withdraw.cancelConfirm": "이 출금을 취소하시겠습니까? 금액은 사용 가능 잔고로 반환됩니다.",

  // 받는 주소 확인; {network}는 네트워크 이름, {short}는 BEP20 / TRC20
  "address.valid": "유효한 {network} 주소",
  "address.checksum": "주소에 오타가 있습니다. 체크섬이 일치하지 않습니다. 지갑에서 다시 붙여 넣으세요.",
  "address.otherNetwork": "다른 네트워크의 주소입니다. {network} ({short}) 주소를 입력하거나 위에서 네트워크를 변경하세요.",
  "address.contract": "지갑 주소가 아닌 USDT 토큰 컨트랙트 주소입니다. 본인의 지갑 주소를 입력하세요.",

  // 이메일 코드 확인 시트
  "stepup.willEmail": "확인용 6자리 코드를 이메일로 보내 드립니다. 코드를 입력하기 전에는 아무것도 전송되지 않습니다.",
  "stepup.sendCode": "이메일로 코드 받기",
  "stepup.codeLabel": "6자리 코드",

  // 이체
  "transfer.eyebrow": "지갑 ↔ 계좌",
  "transfer.swap": "방향 전환",
  "transfer.freeMargin": "가용 증거금",
  "transfer.marginLevel": "증거금 수준",
  // {amount}는 USD
  "transfer.overWithdrawable": "현재 이 계좌에서 최대 {amount} USD까지 이체할 수 있습니다(보유 중인 거래의 증거금은 유지됩니다).",
  // {amount} 예: "USC 10,000.00"
  "transfer.arrivesAs": "{amount}(으)로 입금",
  "transfer.arrives": "도착",
  "transfer.confirmTitle": "이체 확인",
  "transfer.confirm": "이체 확인",

  // 거래 상세 시트
  "detail.confirmations": "확인 횟수",
  // 조정 또는 기타 입금에 붙는 백오피스 명세 메모 라벨
  "detail.note": "메모",
  "detail.reason": "사유",
  "detail.reference": "참조 번호",

  "error.staffReadOnly": "읽기 전용 직원 세션입니다. 변경할 수 없습니다.",
};
export default mobileWallet;
