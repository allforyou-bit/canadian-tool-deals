// 404 page copy (app/not-found.tsx). Bilingual, because a missing page can be reached from either language.
import { FREE_WRITING_PATH, PATHS } from './routes'
import { PRACTICE_MODE } from './site'

export const NOT_FOUND = {
  en: {
    title: 'Page not found',
    body: 'The page you were looking for does not exist or has moved.',
    links: [
      { label: 'Home', href: PATHS.home },
      { label: 'Try a free writing task', href: FREE_WRITING_PATH },
      { label: PRACTICE_MODE.label.en, href: PATHS.practice },
      { label: 'Help centre', href: PATHS.help },
    ],
  },
  ko: {
    title: '페이지를 찾을 수 없어요',
    body: '찾으시는 페이지가 없거나 주소가 바뀌었어요.',
    links: [
      { label: '한국어 홈', href: PATHS.homeKo },
      { label: PRACTICE_MODE.label.ko, href: `${PATHS.practice}?lang=ko` },
      { label: '요금', href: PATHS.pricingKo },
    ],
  },
} as const
