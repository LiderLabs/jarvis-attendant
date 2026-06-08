'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Logo } from '@/components/Logo';
import { 
  User, 
  Calendar, 
  Clock, 
  Building2, 
  CheckCircle, 
  Package, 
  DollarSign,
  Coffee,
  LogOut,
  ArrowLeft,
  Hourglass
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';

interface ActiveStaff {
  id: string;
  name: string;
  role: string;
  clockInTime: string;
  shiftId: string;
  onBreak?: boolean;
  breakStartTime?: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default function ShiftManagementPage() {
  const router = useRouter();
  const [staffData, setStaffData] = useState<ActiveStaff | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftNotes, setShiftNotes] = useState('');

  const [shiftStats] = useState({
    ordersProcessed: 12,
    cashInDrawer: 450.00,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const activeStaffData = sessionStorage.getItem('rapidwash_active_staff');
    const storedBranch = sessionStorage.getItem('rapidwash_branch');
    
    if (activeStaffData) {
      try {
        const parsed = JSON.parse(activeStaffData);
        const staff = Array.isArray(parsed) ? parsed[0] : parsed;
        if (staff) {
          setStaffData({
            id: staff.id,
            name: staff.name,
            role: staff.role || 'Attendant',
            clockInTime: staff.clockInTime || staff.signedInAt || new Date().toISOString(),
            shiftId: staff.shiftId || `SH-${Math.floor(Math.random() * 90000) + 10000}`,
            onBreak: staff.onBreak,
            breakStartTime: staff.breakStartTime
          });
        } else {
          router.push('/washstation');
          return;
        }
      } catch (error) {
        console.error('Error parsing staff data:', error);
        router.push('/washstation');
        return;
      }
    } else {
      router.push('/washstation');
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

  const calculateDuration = () => {
    if (!staffData) return '0h 0m';
    const clockIn = new Date(staffData.clockInTime);
    const minutes = differenceInMinutes(currentTime, clockIn);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleClockOut = () => {
    if (!staffData || typeof window === 'undefined') return;

    sessionStorage.removeItem('rapidwash_active_staff');

    try {
      const attendanceLog = JSON.parse(localStorage.getItem('rapidwash_attendance_log') || '[]');
      attendanceLog.push({
        staffId: staffData.id,
        staffName: staffData.name,
        branchId: branch?.id,
        branchName: branch?.name,
        action: 'clock_out',
        timestamp: new Date().toISOString(),
        shiftId: staffData.shiftId,
        notes: shiftNotes,
        ordersProcessed: shiftStats.ordersProcessed,
      });
      localStorage.setItem('rapidwash_attendance_log', JSON.stringify(attendanceLog));
    } catch (error) {
      console.error('Error saving attendance log:', error);
    }

    sessionStorage.removeItem('rapidwash_branch');
    toast.success(`${staffData.name} clocked out successfully`);
    router.push('/washstation');
  };

  const handleBreakToggle = () => {
    if (!staffData || typeof window === 'undefined') return;

    const activeStaffData = sessionStorage.getItem('rapidwash_active_staff');
    if (activeStaffData) {
      try {
        const activeStaff: ActiveStaff[] = JSON.parse(activeStaffData);
        const staffIndex = activeStaff.findIndex(s => s.id === staffData.id);
        
        if (staffIndex !== -1) {
          if (staffData.onBreak) {
            activeStaff[staffIndex] = { ...activeStaff[staffIndex], onBreak: false, breakStartTime: undefined };
            toast.success('Break ended');
          } else {
            activeStaff[staffIndex] = { ...activeStaff[staffIndex], onBreak: true, breakStartTime: new Date().toISOString() };
            toast.success('Break started');
          }
          
          sessionStorage.setItem('rapidwash_active_staff', JSON.stringify(activeStaff));
          setStaffData(activeStaff[staffIndex]);
          window.dispatchEvent(new Event('storage'));
        }
      } catch (error) {
        console.error('Error updating break status:', error);
      }
    }
  };

  if (!staffData) return null;

  const clockInTime = new Date(staffData.clockInTime);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/washstation/dashboard')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <Logo size="sm" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Confirm Clock Out</h1>
            <p className="text-muted-foreground mt-2">
              Review your shift details below before ending your session.
            </p>
          </div>

          <div className="flex justify-end mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-200 dark:border-emerald-700">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              SYSTEM ONLINE
            </span>
          </div>

          {/* Staff Card */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                {staffData.onBreak && (
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                    <Coffee className="w-3 h-3 text-white" />
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">{staffData.name}</h2>
                <p className="text-primary font-medium">{staffData.role}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <span className="text-primary">#</span> Shift ID: {staffData.shiftId}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span>DATE</span>
                </div>
                <p className="font-semibold text-foreground">{format(clockInTime, 'MMM dd, yyyy')}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 mb-1">
                  <Building2 className="w-4 h-4" />
                  <span>STORE</span>
                </div>
                <p className="font-semibold text-foreground">#{branch?.code || 'ACD'}</p>
              </div>
            </div>

            {/* Time Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="w-4 h-4" />
                  <span>CLOCK IN</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {format(clockInTime, 'hh:mm')}
                  <span className="text-base ml-1">{format(clockInTime, 'a')}</span>
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <LogOut className="w-4 h-4" />
                  <span>CLOCK OUT</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {format(currentTime, 'hh:mm')}
                  <span className="text-base ml-1">{format(currentTime, 'a')}</span>
                </p>
              </div>
              <div className="bg-primary/10 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-primary mb-2">
                  <Hourglass className="w-4 h-4" />
                  <span>TOTAL DURATION</span>
                </div>
                <p className="text-2xl font-bold text-primary">{calculateDuration()}</p>
              </div>
            </div>

            {/* Shift Summary */}
            <div className="bg-muted/30 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-muted-foreground" />
                <span className="font-semibold text-foreground">SHIFT SUMMARY</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Total Orders Processed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{shiftStats.ordersProcessed} Orders</span>
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Cash in Drawer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">₵{shiftStats.cashInDrawer.toFixed(2)}</span>
                    <button className="text-primary text-sm font-medium hover:underline">Verify</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Shift Notes */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-muted-foreground">✏️ Shift Notes</span>
                <span className="text-xs text-muted-foreground">(Optional)</span>
              </div>
              <Textarea
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="E.g. Machine 4 reported a drainage error. Cash drawer count confirmed."
                className="bg-muted/50 border-0 rounded-xl resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/washstation/dashboard')}
                className="flex-1 h-14 rounded-xl text-base"
              >
                Cancel
              </Button>
              <Button
                onClick={handleClockOut}
                className="flex-[2] h-14 rounded-xl text-base gap-2 bg-primary hover:bg-primary/90"
              >
                <CheckCircle className="w-5 h-5" />
                Confirm Clock Out
              </Button>
            </div>
            
            <Button
              variant="outline"
              onClick={handleBreakToggle}
              className={`w-full h-12 rounded-xl ${staffData.onBreak ? 'border-amber-500 text-amber-600' : ''}`}
            >
              <Coffee className="w-4 h-4 mr-2" />
              {staffData.onBreak ? 'End Break' : 'Take Break'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}