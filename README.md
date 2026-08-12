This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 가계부 (`/budget`)

휴대폰에서 쓰는 1인용 가계부입니다. 계정도 서버도 없고, 데이터는 브라우저(localStorage)에만 저장됩니다.

| 화면 | 경로 | 하는 일 |
| --- | --- | --- |
| 홈 | `/budget` | 월 지출·수입·예산 진행률, 일별 지출 차트, 분류별 지출 |
| 입력 | `/budget/add` | 카드 승인 문자 붙여넣기 자동 인식, 직접 입력 |
| 내역 | `/budget/list` | 월·분류·검색 필터, 수정/삭제 |
| 가져오기 | `/budget/import` | 은행·카드사 거래내역 CSV 자동 인식 |
| 설정 | `/budget/settings` | 통화, 예산, 분류 규칙, 자동화 안내, 백업/복원 |

### 자동 등록

`/budget/ingest?auto=1&text=<문자 내용>` 주소를 열면 문자를 파싱해 바로 저장합니다.
아이폰 단축어의 "메시지 수신 → URL 열기", 안드로이드 MacroDroid/Tasker의 "SMS 수신 → 웹페이지 열기"에
이 주소를 걸면 결제 문자가 올 때마다 자동으로 쌓입니다. `auto=1`을 빼면 저장 전에 확인 화면이 뜹니다.

### 인식 지원 범위

- 국내 카드/은행 문자(신한·삼성·현대·KB국민·롯데·하나·우리·BC·NH농협·카카오·토스 등)
- 캐나다 은행/카드 알림(TD·RBC·Scotiabank·CIBC·BMO·Amex·Tangerine·Simplii 등)
- 헤더 유무와 열 순서가 다른 CSV(날짜/내용/금액 또는 출금·입금 분리 열, 금액 부호 자동 판별)

파서 로직은 `lib/budget/parse.ts`, CSV는 `lib/budget/csv.ts`, 저장은 `lib/budget/store.ts`에 있습니다.
