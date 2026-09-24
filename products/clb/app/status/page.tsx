import type { Metadata } from 'next'
import { StatusClient } from './StatusClient'

export const metadata: Metadata = {
  title: 'Service status',
  description: 'Whether practice feedback and purchases are working right now.',
}

export default function StatusPage() {
  return <StatusClient />
}
