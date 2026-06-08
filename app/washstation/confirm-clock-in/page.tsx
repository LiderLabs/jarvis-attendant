'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { CheckCircle, X, User, Calendar, Clock, Building2 } from 'lucide-react';
import { format } from 'date-fns';


interface StaffData {
  id: string;
  name: string;
  role?: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default function ConfirmClockInPage() {
  const router = useRouter();
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const pendingStaff = sessionStorage.getItem('washstation_pending_staff');
    const storedBranch = sessionStorage.getItem('rapidwash_branch');
    
    if (pendingStaff) {
      try {
        setStaffData(JSON.parse(pendingStaff));
      } catch (error) {
        console.error('Error parsing pending staff:', error);
      }
    } else {
      router.push('/washstation/scan');
      return;
    }
    
    if (storedBranch) {
      try {
        setBranch(JSON.parse(storedBranch));
      } catch (error) {
        console.error('Error parsing branch:', error);
      }
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [router]);

  const handleConfirm = () => {
    if (!staffData || typeof window === 'undefined') return;

    const existingStaff = sessionStorage.getItem('rapidwash_active_staff');
    const activeStaff = existingStaff ? JSON.parse(existingStaff) : [];

    const newStaffEntry = {
      id: staffData.id,
      name: staffData.name,
      role: staffData.role || 'Attendant',
      clockInTime: new Date().toISOString(),
      signedInAt: new Date().toISOString(),
      shiftId: `SH-${Math.floor(Math.random() * 90000) + 10000}`,
    };

    activeStaff.push(newStaffEntry);
    sessionStorage.setItem('rapidwash_active_staff', JSON.stringify(activeStaff));
    
    if (branch) {
      sessionStorage.setItem('rapidwash_branch', JSON.stringify(branch));
    }
    
    sessionStorage.removeItem('washstation_pending_staff');
    sessionStorage.setItem('rapidwash_current_staff', JSON.stringify(newStaffEntry));

    try {
      const attendanceLog = JSON.parse(localStorage.getItem('rapidwash_attendance_log') || '[]');
      attendanceLog.push({
        staffId: staffData.id,
        staffName: staffData.name,
        branchId: branch?.id,
        branchName: branch?.name,
        action: 'clock_in',
        timestamp: new Date().toISOString(),
        shiftId: newStaffEntry.shiftId,
      });
      localStorage.setItem('rapidwash_attendance_log', JSON.stringify(attendanceLog));
    } catch (error) {
      console.error('Error saving attendance log:', error);
    }

    window.dispatchEvent(new Event('storage'));
    router.push('/washstation/dashboard');
  };

  const handleCancel = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('washstation_pending_staff');
    }
    router.push('/washstation/scan');
  };

  if (!staffData) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-border flex items-center justify-between">
        <Logo size="sm" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Confirm Clock In</h1>
            <p className="text-muted-foreground mt-2">
              Review your details below before starting your session.
            </p>
          </div>

          {/* System Status */}
          <div className="flex justify-end mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-200 dark:border-emerald-700">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              SYSTEM ONLINE
            </span>
          </div>

          {/* Staff Card */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">{staffData.name}</h2>
                <p className="text-primary font-medium">{staffData.role || 'Attendant'}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <span className="text-primary">#</span> Shift ID: Pending
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span>DATE</span>
                </div>
                <p className="font-semibold text-foreground">{format(currentTime, 'MMM dd, yyyy')}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 mb-1">
                  <Building2 className="w-4 h-4" />
                  <span>BRANCH</span>
                </div>
                <p className="font-semibold text-foreground">{branch?.name || 'Academic City'}</p>
              </div>
            </div>

            {/* Time Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="w-4 h-4" />
                  <span>CLOCK IN</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {format(currentTime, 'hh:mm')}
                  <span className="text-lg ml-1">{format(currentTime, 'a')}</span>
                </p>
              </div>
              <div className="bg-primary/10 rounded-xl p-4 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-primary font-medium mb-1">READY TO START</p>
                  <CheckCircle className="w-8 h-8 text-primary mx-auto" />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 h-14 rounded-xl text-base"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm} disabled={isConfirming}
              className="flex-[2] h-14 rounded-xl text-base gap-2 bg-primary hover:bg-primary/90"
            >
              <CheckCircle className="w-5 h-5" />
              Confirm Clock In
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}