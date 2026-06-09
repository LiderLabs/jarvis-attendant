'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/Logo'
import Image from 'next/image'
import { Loader2, ArrowRight, Lock, Phone, Truck } from 'lucide-react'
import { toast } from 'sonner'

export default function DriverLoginPage() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const loginDriver = useMutation((api as any).drivers.loginDriver)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneNumber.trim()) { toast.error('Enter your phone number'); return }
    if (!pin.trim() || pin.length < 4) { toast.error('Enter your 4-digit PIN'); return }

    setIsLoading(true)
    try {
      const result = await loginDriver({
        phoneNumber: phoneNumber.trim(),
        pin: pin.trim(),
        deviceInfo: JSON.stringify({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        }),
      })

      localStorage.setItem('driver_token', result.driverToken)
      localStorage.setItem('driver_id', result.driverId)
      localStorage.setItem('driver_name', result.driverName)
      localStorage.setItem('driver_branch_id', result.branchId)

      toast.success(`Welcome, ${result.driverName}!`)
      router.push('/driver/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-2 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center">
              <Logo className="h-8 w-auto" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold">Driver Portal</CardTitle>
              <CardDescription>Sign in to manage deliveries</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="e.g. 0241234567"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value.replace(/\s/g, ''))}
                    className="pl-10 h-12 text-base"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    placeholder="Enter your PIN"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="pl-10 h-12 text-base tracking-widest text-center font-bold"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold"
                disabled={isLoading || !phoneNumber.trim() || pin.length < 4}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</>
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </form>

          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground text-sm mt-6">
          © {new Date().getFullYear()} Rapid Wash · Powered by Lider Technologies LTD
        </p>
      </div>
    </div>
  )
}

