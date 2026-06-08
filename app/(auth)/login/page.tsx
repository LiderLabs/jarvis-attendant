'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from "@jordan6699/washlab-backend/api";
import { Id } from "@jordan6699/washlab-backend/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { Loader2, ArrowRight, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { LoginFlow } from '@/components/auth/LoginFlow';

type LoginStep = 'branch-code' | 'branch-info' | 'station-login' | 'attendant-auth';

export default function LoginPage() {
  const router = useRouter();
  
  useEffect(() => {
    if (typeof window === "undefined") return
    const stationToken = localStorage.getItem("station_token")
    const branchId = localStorage.getItem("station_branch_id")

    if (stationToken && branchId) {
      router.push("/washstation/dashboard")
    }
  }, [router])

  const [step, setStep] = useState<LoginStep>("branch-code")
  const [branchCode, setBranchCode] = useState("")
  const [branchId, setBranchId] = useState<Id<"branches"> | null>(null)
  const [stationPin, setStationPin] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const deviceId = useState<string>(() => {
    if (typeof window === "undefined") {
      return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    let deviceId = localStorage.getItem("washstation_device_id")
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem("washstation_device_id", deviceId)
    }
    return deviceId
  })[0]

  const branchInfo = useQuery(
    api.admin.getBranchByCode,
    submitted && branchCode.length >= 2
      ? { code: branchCode.toUpperCase() }
      : (step === "branch-info" || step === "station-login") && branchCode.length >= 2
      ? { code: branchCode.toUpperCase() }
      : "skip"
  )

  // Auto-advance to branch-info once query resolves after submit
  useEffect(() => {
    if (!submitted) return
    if (branchInfo === undefined) return
    if (!branchInfo) {
      toast({ title: "Invalid branch code", description: "The branch code you entered is not valid or inactive.", variant: "destructive" })
      setSubmitted(false)
      return
    }
    setBranchId(branchInfo._id)
    setStep("branch-info")
    setSubmitted(false)
  }, [branchInfo, submitted])

  const loginStation = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).stations?.loginStation as any
  )

  const handleBranchCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!branchCode.trim()) {
      toast({
        title: "Branch code required",
        description: "Please enter a branch code",
        variant: "destructive",
      })
      return
    }

    setSubmitted(true)
    // useEffect handles the rest once branchInfo resolves
  }

  const handleContinueToSignIn = async () => {
    if (!branchId || !branchInfo) {
      toast({
        title: "Error",
        description: "Branch information is missing",
        variant: "destructive",
      })
      return
    }
    setStep("station-login")
  }

  const handleStationLogin = async (pin: string | null) => {
    if (!branchId || !branchInfo) {
      toast({
        title: "Error",
        description: "Branch information is missing",
        variant: "destructive",
      })
      return
    }

    if (!pin || !pin.trim()) {
      toast({
        title: "Station PIN required",
        description: "Please enter the station PIN to continue",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoggingIn(true)

      const deviceInfo = JSON.stringify({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      })

      const result = await loginStation({
        branchId,
        deviceId,
        stationPin: pin || undefined,
        deviceInfo,
      })

      if (result?.stationToken && typeof window !== "undefined") {
        localStorage.setItem("station_token", result.stationToken)
        localStorage.setItem("station_branch_id", branchId)
        localStorage.setItem("station_device_id", deviceId)
        localStorage.setItem("station_session_id", result.sessionId)
        localStorage.setItem("station_branch_name", branchInfo.name)

        toast({
          title: "Station login successful",
          description: `Welcome to ${branchInfo.name}`,
        })

        router.push("/washstation/dashboard")
      } else {
        throw new Error("Station login failed")
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to login to station"
      toast({
        title: "Station login failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleStationPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleStationLogin(stationPin);
  };

  if (step === 'branch-code') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center">
              <Logo className="h-8 w-auto" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">WashStation</CardTitle>
              <CardDescription className="text-base">
                Enter your branch code to begin
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleBranchCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="branchCode" className="text-sm font-medium">
                  Branch Code
                </Label>
                <Input
                  id="branchCode"
                  type="text"
                  placeholder="e.g., ACD"
                  value={branchCode}
                  onChange={(e) => {
                    setBranchCode(e.target.value.toUpperCase().trim())
                    setSubmitted(false)
                  }}
                  className="text-center text-lg font-semibold tracking-wider uppercase"
                  maxLength={10}
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoggingIn || !branchCode.trim()}
              >
                {submitted && branchInfo === undefined ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
          Â© {new Date().getFullYear()} Rapid Wash Â· Powered by Lider Technologies LTD
        </div>
      </div>
    );
  }

  if (step === 'branch-info' && branchInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center">
              <Logo className="h-8 w-auto" />
            </div>
            <CardTitle className="text-2xl font-bold">WashStation</CardTitle>
            <CardDescription className="text-base">
              Branch Information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Branch Name</Label>
                <p className="text-lg font-semibold">{branchInfo.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Code</Label>
                <p className="text-lg font-mono font-semibold">{branchInfo.code}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                <p className="text-sm">{branchInfo.address}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">City</Label>
                <p className="text-sm">{branchInfo.city}, {branchInfo.country}</p>
              </div>
              {branchInfo.phoneNumber && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                  <p className="text-sm">{branchInfo.phoneNumber}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep('branch-code');
                  setBranchId(null);
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleContinueToSignIn}
              >
                Continue to Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'station-login' && branchInfo && branchId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center">
              <Logo className="h-8 w-auto" />
            </div>
            <CardTitle className="text-2xl font-bold">WashStation</CardTitle>
            <CardDescription className="text-base">
              Station Login Required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Branch Name</Label>
                <p className="text-lg font-semibold">{branchInfo.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Code</Label>
                <p className="text-lg font-mono font-semibold">{branchInfo.code}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                <p className="text-sm">{branchInfo.address}</p>
              </div>
            </div>

            <form onSubmit={handleStationPinSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stationPin" className="text-sm font-medium">
                  Station PIN
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="stationPin"
                    type="password"
                    placeholder="Enter station PIN"
                    value={stationPin}
                    onChange={(e) => setStationPin(e.target.value)}
                    className="pl-10 text-center text-lg font-semibold tracking-wider"
                    autoFocus
                    required
                    disabled={isLoggingIn}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the station PIN to access the workstation
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep('branch-info');
                    setStationPin('');
                  }}
                  disabled={isLoggingIn}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={isLoggingIn || !stationPin.trim()}
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      Login to Station
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'attendant-auth' && branchId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center">
              <Logo className="h-8 w-auto" />
            </div>
            <CardTitle className="text-2xl font-bold">WashStation</CardTitle>
            <CardDescription className="text-base">
              Sign in to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginFlow
              branchId={branchId}
              onSuccess={() => {
                router.push('/washstation/dashboard');
              }}
              onBack={() => {
                setStep('station-login');
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
