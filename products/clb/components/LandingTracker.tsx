'use client'

import { useEffect } from 'react'
import { track } from '../lib/track'

/** Sends the first-party 'landing' event once per browser session. */
export function LandingTracker() {
  useEffect(() => {
    track('landing')
  }, [])
  return null
}
