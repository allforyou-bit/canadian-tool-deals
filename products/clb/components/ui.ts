// Shared Tailwind class strings, so buttons, cards and form fields look the same everywhere.

export const cls = {
  btn: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
  primary: 'bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 focus-visible:outline-slate-700',
  danger: 'border border-red-700 bg-white text-red-800 hover:bg-red-50 focus-visible:outline-red-700',
  card: 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6',
  input:
    'block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 focus:border-red-700 focus:outline-2 focus:outline-offset-0 focus:outline-red-700',
  label: 'block text-sm font-semibold text-slate-800',
  checkbox: 'mt-1 size-5 shrink-0 accent-red-700',
  link: 'font-medium text-red-800 underline underline-offset-2 hover:text-red-950',
  h1: 'text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl',
  h2: 'text-xl font-semibold text-slate-950',
  muted: 'text-sm text-slate-600',
} as const

export const tone = {
  error: 'rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950',
  info: 'rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950',
  success: 'rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950',
  warn: 'rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950',
} as const
