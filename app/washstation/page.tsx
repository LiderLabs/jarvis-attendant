'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { getActiveBranches, getBranchByCode, Branch } from '@/config/branches';
import Image from 'next/image';
import { Logo } from '@/components/Logo'

/**
 * Branch Entry Page
 * 
 * First screen staff sees when opening WashStation
 * - Enter branch code to identify location
 * - Proceed to biometric scan
 */
export default function BranchEntryPage() {
  const router = useRouter();
  const [branchCode, setBranchCode] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const activeStaff = sessionStorage.getItem('Rapid Wash_active_staff');
    const branch = sessionStorage.getItem('Rapid Wash_branch');
    if (activeStaff && branch) {
      router.push('/washstation/dashboard');
    }
  }, [router]);

  const handleCodeChange = (code: string) => {
    const upperCode = code.toUpperCase();
    setBranchCode(upperCode);
    
    const branch = getBranchByCode(upperCode);
    setSelectedBranch(branch && branch.isActive ? branch : null);
  };

  const handleContinue = () => {
    if (!selectedBranch) {
      toast.error('Please enter a valid branch code');
      return;
    }
    
    // Store branch in session with consistent key
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('Rapid Wash_branch', JSON.stringify(selectedBranch));
    }
    router.push('/washstation/scan');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/95 to-primary flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Logo size="sm" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-card rounded-3xl p-8 shadow-2xl">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-8 h-8 text-primary" />
            </div>

            <p className="text-center text-muted-foreground mb-8">
              Enter your branch code to begin
            </p>

            <div className="space-y-6">
              <div>
                <Label>Branch Code</Label>
                <Input
                  value={branchCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="e.g., ACD"
                  className="mt-2 text-center text-2xl font-bold tracking-widest h-14"
                  maxLength={3}
                />
              </div>

              {selectedBranch && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
                  <p className="text-sm text-muted-foreground">Selected Branch</p>
                  <p className="text-lg font-bold text-foreground">{selectedBranch.name}</p>
                </div>
              )}

              <Button
                onClick={handleContinue}
                disabled={!selectedBranch}
                className="w-full h-14 text-lg rounded-xl gap-2"
              >
                Continue to Sign In
                <ArrowRight className="w-5 h-5" />
              </Button>

              <Button
                onClick={() => router.push('/washstation/dashboard')}
                variant="outline"
                className="w-full h-12 text-base rounded-xl gap-2"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-center text-muted-foreground">
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-white/60 text-sm">
          © 2026 Rapid Wash · Powered by Lider Technologies LTD
        </p>
      </footer>
    </div>
  );
}
