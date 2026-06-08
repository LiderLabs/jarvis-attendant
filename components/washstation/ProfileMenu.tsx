'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Clock, 
  LogOut, 
  Settings,
  ChevronRight,
  Coffee,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProfileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  staff: { name: string; role: string; id?: string; clockInTime?: string } | null;
  branchName?: string;
}

const ProfileMenu = ({ isOpen, onClose, staff, branchName }: ProfileMenuProps) => {
  const router = useRouter();
  const [isOnBreak, setIsOnBreak] = useState(false);

  if (!isOpen || !staff) return null;

  const getElapsedTime = () => {
    if (!staff.clockInTime) return '00:00:00';
    const now = new Date();
    const clockIn = new Date(staff.clockInTime);
    const diff = now.getTime() - clockIn.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleViewShift = () => {
    onClose();
    router.push('/washstation/shift');
  };

  const handleSettings = () => {
    onClose();
    router.push('/washstation/settings');
  };

  const handleBreakToggle = () => {
    setIsOnBreak(!isOnBreak);
    // Update session storage with break status
    if (typeof window !== 'undefined') {
      const staffData = sessionStorage.getItem('rapidwash_active_staff');
      if (staffData) {
        const parsed = JSON.parse(staffData);
        const staffList = Array.isArray(parsed) ? parsed : [parsed];
        staffList[0].onBreak = !isOnBreak;
        sessionStorage.setItem('rapidwash_active_staff', JSON.stringify(staffList));
      }
    }
  };

  const handleLogout = () => {
    onClose();
    router.push('/washstation/shift');
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Menu */}
      <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{staff.name}</p>
              <p className="text-sm text-primary">{staff.role}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-muted"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          {/* Status */}
          <div className="mt-3 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnBreak ? 'bg-warning' : 'bg-success'} animate-pulse`} />
            <span className="text-sm text-muted-foreground">
              {isOnBreak ? 'On Break' : 'Active'} • {getElapsedTime()}
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          <button
            onClick={handleViewShift}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-left"
          >
            <Clock className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-foreground">View Shift Details</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            onClick={handleBreakToggle}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-left"
          >
            <Coffee className={`w-5 h-5 ${isOnBreak ? 'text-warning' : 'text-muted-foreground'}`} />
            <span className="flex-1 text-foreground">
              {isOnBreak ? 'End Break' : 'Take Break'}
            </span>
            <div className={`w-3 h-3 rounded-full ${isOnBreak ? 'bg-warning' : 'bg-muted'}`} />
          </button>

          <button
            onClick={handleSettings}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-left"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-foreground">Settings</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="border-t border-border my-2" />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 transition-colors text-left text-destructive"
          >
            <LogOut className="w-5 h-5" />
            <span className="flex-1">Clock Out</span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            {branchName} • Terminal #042
          </p>
        </div>
      </div>
    </>
  );
};

export default ProfileMenu;
