'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { Loader2 } from 'lucide-react'

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [driverToken, setDriverToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('driver_token')
    if (!token) {
      router.push('/driver-login')
      return
    }
    setDriverToken(token)
    setChecked(true)
  }, [router])

  const session = useQuery(
    (api as any).drivers.verifyDriverSession,
    driverToken ? { driverToken } : 'skip'
  )

  useEffect(() => {
    if (session === undefined) return
    if (!session || !session.valid) {
      localStorage.removeItem('driver_token')
      localStorage.removeItem('driver_id')
      localStorage.removeItem('driver_name')
      localStorage.removeItem('driver_branch_id')
      router.push('/driver-login')
    }
  }, [session, router])

  if (!checked || !driverToken || (driverToken && session === null)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-foreground">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p>Verifying session...</p>
        </div>
      </div>
    )
  }

  if (session && !session.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-foreground">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p>Session expired. Redirecting...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}



