'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { Id } from '@jordan6699/washlab-backend/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, LogIn, LogOut, Loader2, AlertCircle, Clock } from 'lucide-react'

function QRClockInContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [selectedAttendantId, setSelectedAttendantId] = useState<string>('')
  const [action, setAction] = useState<'clock_in' | 'clock_out' | null>(null)
  const [pin, setPin] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ action: string; name: string } | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)

  const tokenInfo = useQuery(
    (api as any).qrClockIn.getQRTokenInfo,
    token ? { token } : 'skip'
  )

  const completeQRClockIn = useMutation((api as any).qrClockIn.completeQRClockIn)

  // Countdown
  useEffect(() => {
    if (!tokenInfo?.expiresAt) return
    const update = () => {
      const left = Math.max(0, Math.floor((tokenInfo.expiresAt - Date.now()) / 1000))
      setTimeLeft(left)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [tokenInfo?.expiresAt])

  const selectedAttendant = tokenInfo?.attendants?.find(
    (a: any) => a._id === selectedAttendantId
  )

  const handleSelectAttendant = (att: any) => {
    setSelectedAttendantId(att._id)
    setPin('')
    setError(null)

    // FIX: Derive action from the live isClockedIn flag returned by the backend.
    // Previously the action was set once on click and never updated, so if
    // Convex pushed a fresh tokenInfo (e.g. after another device clocked in),
    // the action could be stale. Always derive from current server state.
    setAction(att.isClockedIn ? 'clock_out' : 'clock_in')
  }

  const handleSubmit = async () => {
    if (!token || !selectedAttendantId || !action || !pin) return

    // FIX: Re-derive the action from the latest server data right before
    // submitting. If the attendant's status changed between selection and
    // submit (e.g. they clocked in on another device), this catches it and
    // shows a clear error instead of creating a duplicate clock-in record.
    const latestAttendant = tokenInfo?.attendants?.find(
      (a: any) => a._id === selectedAttendantId
    )
    const latestAction = latestAttendant?.isClockedIn ? 'clock_out' : 'clock_in'

    if (latestAction !== action) {
      // Status changed since the attendant was selected — update UI and abort
      setAction(latestAction)
      setError(
        latestAttendant?.isClockedIn
          ? `${latestAttendant.name} is already clocked in. Use Clock Out instead.`
          : `${latestAttendant?.name} is not clocked in. Use Clock In instead.`
      )
      return
    }

    // FIX: Extra client-side guard — block clock_in if already clocked in.
    // The backend should also enforce this, but this prevents a wasted round-trip.
    if (action === 'clock_in' && latestAttendant?.isClockedIn) {
      setError(`${latestAttendant.name} is already clocked in. Please clock out first.`)
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await completeQRClockIn({
        token,
        attendantId: selectedAttendantId as Id<'attendants'>,
        action,
        pin,
        attendanceLogId: action === 'clock_out' ? selectedAttendant?.attendanceLogId : undefined,
      })
      setSuccess({ action: result.action, name: result.attendantName })
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <p className="text-lg font-semibold">Invalid QR Code</p>
        <p className="text-sm text-muted-foreground mt-1">Please scan a valid QR code from the tablet.</p>
      </div>
    )
  }

  if (tokenInfo === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-4">
        <CheckCircle className="w-20 h-20 text-green-500" />
        <h1 className="text-2xl font-bold text-green-600">
          {success.action === 'clock_in' ? 'Clocked In!' : 'Clocked Out!'}
        </h1>
        <p className="text-muted-foreground">Welcome, {success.name}</p>
        <p className="text-sm text-muted-foreground mt-2">You can close this page now.</p>
      </div>
    )
  }

  if (timeLeft === 0 && tokenInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-3">
        <AlertCircle className="w-12 h-12 text-orange-500" />
        <p className="text-lg font-semibold">QR Code Expired</p>
        <p className="text-sm text-muted-foreground">Please ask for a new QR code on the tablet.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Clock In / Out</CardTitle>
          <CardDescription>{tokenInfo?.branchName}</CardDescription>
          {timeLeft > 0 && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <Badge variant={timeLeft < 60 ? 'destructive' : 'secondary'} className="text-xs">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')} left
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Select Attendant */}
          <div className="space-y-2">
            <Label>Who are you?</Label>
            <div className="grid gap-2">
              {tokenInfo?.attendants?.map((att: any) => (
                <button
                  key={att._id}
                  onClick={() => handleSelectAttendant(att)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                    selectedAttendantId === att._id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="font-medium">{att.name}</span>
                  <Badge variant={att.isClockedIn ? 'default' : 'secondary'} className="text-xs">
                    {att.isClockedIn ? 'Clocked In' : 'Not Clocked In'}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Show action + PIN */}
          {selectedAttendantId && action && (
            <>
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                action === 'clock_in' ? 'bg-green-50 dark:bg-green-950/30' : 'bg-orange-50 dark:bg-orange-950/30'
              }`}>
                {action === 'clock_in'
                  ? <LogIn className="w-4 h-4 text-green-600" />
                  : <LogOut className="w-4 h-4 text-orange-600" />
                }
                <span className="text-sm font-medium">
                  {action === 'clock_in' ? 'Clock In' : 'Clock Out'} as {selectedAttendant?.name}
                </span>
              </div>

              <div className="space-y-2">
                <Label>Enter your PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-xl tracking-widest"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || pin.length < 4 || timeLeft === 0}
                className={`w-full ${action === 'clock_out' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
              >
                {isSubmitting
                  ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  : action === 'clock_in'
                    ? <LogIn className="w-4 h-4 mr-2" />
                    : <LogOut className="w-4 h-4 mr-2" />
                }
                {action === 'clock_in' ? 'Clock In' : 'Clock Out'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function QRClockInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <QRClockInContent />
    </Suspense>
  )
}
