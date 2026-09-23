import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Page not found · 페이지를 찾을 수 없습니다</h1>
      <p className="mt-6 flex justify-center gap-4">
        <Link className="underline" href="/">
          Home
        </Link>
        <Link className="underline" href="/ko/">
          홈
        </Link>
      </p>
    </main>
  )
}
