'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from "react"
import { useQuery } from "convex/react"
import { api } from "@jordan6699/washlab-backend/api"
import { EnrollmentFlow } from "@/components/auth/EnrollmentFlow"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Shield, Clock, CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/Logo"
import { formatDistanceToNow } from "date-fns"

/**
 * Enrollment page that handles query parameter token format
 * Backend generates links as: /enroll?token=...
 */
function EnrollmentQueryPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  // Verify enrollment token
  const tokenVerification = useQuery(
    api.attendants.verifyEnrollmentToken,
    token ? { token } : "skip"
  )

  // Handle missing token
  if (!token) {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <Card className='max-w-md w-full shadow-lg border-destructive/50'>
          <CardHeader className='text-center space-y-4'>
            <div className='flex justify-center'>
              <Logo className='h-12 w-auto' />
            </div>
            <div>
              <CardTitle className='text-2xl text-destructive'>
                Invalid Enrollment Link
              </CardTitle>
              <CardDescription className='mt-2'>
                The enrollment token is missing from the URL.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant='destructive'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                Please use the enrollment link provided by your administrator.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (tokenVerification === undefined) {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <Card className='max-w-md w-full shadow-lg'>
          <CardHeader className='text-center space-y-4'>
            <div className='flex justify-center'>
              <Logo className='h-12 w-auto' />
            </div>
            <div>
              <CardTitle className='text-2xl'>
                Verifying Enrollment Link
              </CardTitle>
              <CardDescription className='mt-2'>
                Please wait while we verify your enrollment token...
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className='flex flex-col items-center justify-center py-12 space-y-4'>
            <Loader2 className='h-10 w-10 animate-spin text-primary' />
            <p className='text-sm text-muted-foreground'>
              This may take a few seconds
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (!tokenVerification.valid) {
    const errorMessage =
      tokenVerification.error ||
      "The enrollment link is invalid or has expired."
    const isExpired = errorMessage.toLowerCase().includes("expired")
    const isAlreadyEnrolled = errorMessage
      .toLowerCase()
      .includes("already enrolled")

    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <Card
          className={`max-w-md w-full shadow-lg ${isAlreadyEnrolled ? "border-green-500/50" : "border-destructive/50"}`}
        >
          <CardHeader className='text-center space-y-4'>
            <div className='flex justify-center'>
              <Logo className='h-12 w-auto' />
            </div>
            <div>
              <CardTitle
                className={`text-2xl ${isAlreadyEnrolled ? "text-green-600" : "text-destructive"}`}
              >
                {isAlreadyEnrolled
                  ? "Already Enrolled"
                  : isExpired
                    ? "Enrollment Link Expired"
                    : "Invalid Enrollment Link"}
              </CardTitle>
              <CardDescription className='mt-2'>{errorMessage}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Alert variant={isAlreadyEnrolled ? "default" : "destructive"}>
              {isAlreadyEnrolled ? (
                <CheckCircle2 className='h-4 w-4 text-green-600' />
              ) : (
                <AlertCircle className='h-4 w-4' />
              )}
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            {isExpired && (
              <Alert>
                <Clock className='h-4 w-4' />
                <AlertDescription>
                  Enrollment links expire after a set period for security
                  reasons. Please contact your administrator to request a new
                  enrollment link.
                </AlertDescription>
              </Alert>
            )}
            {isAlreadyEnrolled && (
              <div className='flex gap-2'>
                <button
                  onClick={() => router.push("/login")}
                  className='flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors'
                >
                  Go to Login
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success - show enrollment flow
  const expirationDate = new Date(tokenVerification.expiresAt)
  const timeUntilExpiry = formatDistanceToNow(expirationDate, {
    addSuffix: true,
  })
  const isExpiringSoon = expirationDate.getTime() - Date.now() < 30 * 60 * 1000 // Less than 30 minutes

  return (
    <div className='min-h-screen p-4 py-8'>
      <div className='w-full max-w-4xl mx-auto space-y-6'>
        {/* Header Card */}
        <Card className='border-2 shadow-xl'>
          <CardHeader className='text-center space-y-4 pb-6'>
            <div className='flex justify-center'>
              <Logo className='h-16 w-auto' />
            </div>
            <div className='space-y-2'>
              <CardTitle className='text-3xl font-bold'>
                Complete Your Enrollment
              </CardTitle>
              <CardDescription className='text-base'>
                Set up your biometric authentication to access Jarvis
                workstation
              </CardDescription>
            </div>

            {/* Attendant Information */}
            <div className='bg-muted/50 rounded-lg p-4 space-y-3 mt-4'>
              <div className='flex items-center justify-center gap-2'>
                <Shield className='h-5 w-5 text-primary' />
                <span className='font-semibold text-lg'>
                  {tokenVerification.attendant?.name}
                </span>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-2 text-sm'>
                <div className='text-muted-foreground'>
                  <span className='font-medium'>Email:</span>{" "}
                  <span className='text-foreground'>
                    {tokenVerification.attendant?.email}
                  </span>
                </div>
                <div className='text-muted-foreground'>
                  <span className='font-medium'>Branch:</span>{" "}
                  <span className='text-foreground'>
                    {tokenVerification.attendant?.branchName}
                  </span>
                </div>
              </div>
              <div
                className={`text-xs flex items-center justify-center gap-1 ${isExpiringSoon ? "text-destructive" : "text-muted-foreground"}`}
              >
                <Clock
                  className={`h-3 w-3 ${isExpiringSoon ? "animate-pulse" : ""}`}
                />
                <span>
                  {isExpiringSoon ? "⚠️ " : ""}
                  Link expires {timeUntilExpiry}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className='pt-0'>
            <EnrollmentFlow
              token={token}
              attendant={tokenVerification.attendant!}
              expiresAt={tokenVerification.expiresAt}
              onSuccess={() => {
                router.push("/login")
              }}
            />
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className='bg-primary/5 border-primary/20'>
          <CardContent className='pt-6'>
            <div className='flex gap-3'>
              <Shield className='h-5 w-5 text-primary flex-shrink-0 mt-0.5' />
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Security & Privacy</p>
                <p className='text-xs text-muted-foreground'>
                  Your biometric data is encrypted and stored securely using
                  AES-256-GCM encryption. This information is used solely for
                  identity verification and cannot be used to reconstruct your
                  physical features. We follow industry-standard security
                  practices to protect your privacy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function EnrollmentQueryPage() {
  return (
    <Suspense
      fallback={
        <div className='min-h-screen flex items-center justify-center bg-background'>
          <Loader2 className='w-8 h-8 animate-spin text-muted-foreground' />
        </div>
      }
    >
      <EnrollmentQueryPageContent />
    </Suspense>
  )
}
