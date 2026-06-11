'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { Fingerprint, Loader2, CheckCircle, AlertCircle, QrCode } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default function FaceScanPage() {
  const router = useRouter();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [staffName, setStaffName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('rapidwash_branch') || sessionStorage.getItem('washstation_branch');
    if (stored) {
      try {
        const branchData = JSON.parse(stored);
        setBranch(branchData);
        sessionStorage.setItem('rapidwash_branch', JSON.stringify(branchData));
      } catch (error) {
        console.error('Error parsing branch data:', error);
      }
    }
  }, []);

  const handleScan = async () => {
    setStatus('scanning');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockStaff = {
      id: 'staff-001',
      name: 'John Doe',
      role: 'Attendant'
    };
    
    setStaffName(mockStaff.name);
    setStatus('success');
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('washstation_pending_staff', JSON.stringify(mockStaff));
    }

    setTimeout(() => {
      router.push('/washstation/confirm-clock-in');
    }, 1500);
  };

  const handleQRFallback = () => {
    setErrorMessage('QR fallback not implemented yet');
    setStatus('error');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/95 to-primary flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        {/* Logo — dark variant since header is always on a dark/primary background */}
        <Logo size="sm" className="brightness-0 invert" />
        {branch && (
          <span className="bg-white/20 text-white px-4 py-2 rounded-full text-sm font-semibold">
            {branch.name}
          </span>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-card rounded-3xl p-8 shadow-2xl text-center">
            
            {/* Idle State */}
            {status === 'idle' && (
              <>
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Fingerprint className="w-12 h-12 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Staff Sign In</h1>
                <p className="text-muted-foreground mb-8">
                  Use Face ID or Fingerprint to clock in
                </p>
                <Button onClick={handleScan} className="w-full h-14 text-lg rounded-xl gap-2 mb-4">
                  <Fingerprint className="w-5 h-5" />
                  Scan to Sign In
                </Button>
                <button
                  onClick={handleQRFallback}
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground mx-auto"
                >
                  <QrCode className="w-4 h-4" />
                  Use QR Code instead
                </button>
              </>
            )}

            {/* Scanning State */}
            {status === 'scanning' && (
              <>
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Scanning...</h1>
                <p className="text-muted-foreground">
                  Look at your device or place your finger on the sensor
                </p>
              </>
            )}

            {/* Success State */}
            {status === 'success' && (
              <>
                <div className="w-24 h-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Welcome, {staffName}!</h1>
                <p className="text-muted-foreground mb-4">You've signed in successfully</p>
                <p className="text-sm text-muted-foreground">
                  {new Date().toLocaleTimeString()} • {branch?.name}
                </p>
              </>
            )}

            {/* Error State */}
            {status === 'error' && (
              <>
                <div className="w-24 h-24 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Sign In Failed</h1>
                <p className="text-muted-foreground mb-6">{errorMessage}</p>
                <Button onClick={() => setStatus('idle')} variant="outline" className="w-full h-12 rounded-xl">
                  Try Again
                </Button>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <button
          onClick={() => router.push('/washstation')}
          className="text-white/60 text-sm hover:text-white"
        >
          ← Change Branch
        </button>
      </footer>
    </div>
  );
}
