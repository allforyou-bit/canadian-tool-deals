import type { Category } from './types'

/**
 * Colors are the validated categorical slots (light surface): every adjacent
 * pair clears the normal-vision floor and sits at or above the CVD floor, which
 * the direct labels on every bar back up as secondary encoding.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: '식비·외식', emoji: '🍜', color: '#2a78d6', type: 'expense' },
  { id: 'grocery', name: '장보기', emoji: '🛒', color: '#eb6834', type: 'expense' },
  { id: 'transport', name: '교통·주유', emoji: '🚗', color: '#1baf7a', type: 'expense' },
  { id: 'home', name: '주거·공과금', emoji: '🏠', color: '#eda100', type: 'expense' },
  { id: 'shopping', name: '쇼핑', emoji: '🛍️', color: '#e87ba4', type: 'expense' },
  { id: 'health', name: '건강·의료', emoji: '💊', color: '#008300', type: 'expense' },
  { id: 'fun', name: '여가·구독', emoji: '🎬', color: '#e34948', type: 'expense' },
  { id: 'etc', name: '기타', emoji: '📦', color: '#4a3aa7', type: 'expense' },
  { id: 'income', name: '수입', emoji: '💰', color: '#008300', type: 'income' },
]

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c]),
)

export function categoryOf(id: string): Category {
  return CATEGORY_BY_ID[id] ?? CATEGORY_BY_ID.etc
}

export const EXPENSE_CATEGORIES = DEFAULT_CATEGORIES.filter((c) => c.type === 'expense')

/**
 * Keyword → category. Matched case-insensitively against the merchant name,
 * longest keyword first so "canadian tire" beats "tire".
 */
export const KEYWORD_RULES: Record<string, string[]> = {
  food: [
    '스타벅스', '투썸', '이디야', '맥도날드', '버거킹', '롯데리아', '배달의민족', '요기요', '쿠팡이츠',
    '김밥', '치킨', '피자', '카페', '커피', '식당', '분식', '고기', '주점', '술집', '베이커리', '파리바게',
    'starbucks', 'tim hortons', 'timhortons', 'mcdonald', 'burger', 'subway', 'a&w', 'wendy', 'pizza',
    'sushi', 'ramen', 'restaurant', 'cafe', 'coffee', 'bakery', 'doordash', 'uber eats', 'ubereats',
    'skipthedishes', 'bar &', 'pub', 'kitchen', 'grill', 'chipotle', 'popeyes', 'kfc', 'dairy queen',
  ],
  grocery: [
    '이마트', '홈플러스', '롯데마트', '코스트코', '농협하나로', '편의점', 'gs25', 'cu ', '세븐일레븐', '마트',
    'costco', 'superstore', 'no frills', 'nofrills', 'loblaw', 'metro', 'sobeys', 'safeway', 'freshco',
    'food basics', 'walmart', 't&t', 'h mart', 'hmart', 'save-on-foods', 'farm boy', 'whole foods',
    'independent grocer', 'longo', 'grocery',
  ],
  transport: [
    '주유', '지하철', '버스', '택시', '카카오t', '고속도로', '통행료', '주차', '하이패스', 'ktx', '코레일',
    'petro-canada', 'petrocanada', 'petro canada', 'esso', 'shell', 'husky', 'chevron', 'ultramar',
    'gas ', 'fuel', 'presto', 'ttc', 'go transit', 'translink', 'uber', 'lyft', 'parking', 'park+',
    '407 etr', 'via rail', 'transit',
  ],
  home: [
    '관리비', '전기요금', '한국전력', '도시가스', '수도요금', '월세', '통신요금', 'skt', 'kt ', 'lg u+', '인터넷',
    'rent', 'hydro', 'enbridge', 'fortis', 'rogers', 'bell canada', 'bell ', 'telus', 'fido', 'koodo',
    'virgin plus', 'freedom mobile', 'public mobile', 'insurance', 'property tax', 'utilities',
  ],
  shopping: [
    '쿠팡', '무신사', '지마켓', '11번가', '올리브영', '다이소', '이케아', '네이버페이',
    'amazon', 'canadian tire', 'home depot', 'rona', 'lowes', 'princess auto', 'ikea', 'winners',
    'marshalls', 'homesense', 'dollarama', 'best buy', 'bestbuy', 'apple.com', 'sport chek',
    'indigo', 'staples', 'uniqlo', 'zara', 'h&m', 'aliexpress', 'temu', 'shein',
  ],
  health: [
    '약국', '병원', '의원', '치과', '한의원', '피부과', '건강보험',
    'shoppers drug', 'rexall', 'pharmasave', 'pharmacy', 'dental', 'dentist', 'clinic', 'medical',
    'physio', 'optometr', 'hospital', 'wellness',
  ],
  fun: [
    '넷플릭스', '왓챠', '멜론', '유튜브', '영화', 'cgv', '메가박스', '헬스장', '피트니스', '골프',
    'netflix', 'spotify', 'disney', 'crave', 'youtube', 'prime video', 'cineplex', 'cinema', 'steam',
    'nintendo', 'playstation', 'xbox', 'goodlife', 'fitness', 'gym', 'golf', 'ski', 'patreon',
    'openai', 'anthropic', 'claude', 'icloud', 'google one',
  ],
  income: [
    '급여', '월급', '입금', '이체입금', '환급', '상여',
    'payroll', 'salary', 'direct deposit', 'deposit from', 'refund', 'reimbursement', 'cra ', 'e-transfer received',
  ],
}

const FLAT_RULES: Array<[string, string]> = Object.entries(KEYWORD_RULES)
  .flatMap(([category, keywords]) => keywords.map((k) => [k.toLowerCase(), category] as [string, string]))
  .sort((a, b) => b[0].length - a[0].length)

/**
 * Guess a category from a merchant name. User rules (from settings) win over
 * the built-in keyword table.
 */
export function guessCategory(
  merchant: string,
  userRules: Array<{ keyword: string; category: string }> = [],
  fallback = 'etc',
): string {
  const text = merchant.toLowerCase()
  const sortedUserRules = [...userRules].sort((a, b) => b.keyword.length - a.keyword.length)
  for (const rule of sortedUserRules) {
    const keyword = rule.keyword.trim().toLowerCase()
    if (keyword && text.includes(keyword)) return rule.category
  }
  for (const [keyword, category] of FLAT_RULES) {
    if (text.includes(keyword)) return category
  }
  return fallback
}
