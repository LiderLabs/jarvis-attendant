'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@jordan6699/washlab-backend/api';
import { useStationSession } from '@/hooks/useStationSession';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Package, 
  Settings,
  Clock,
  CreditCard,
  // Activity,
  Bell,
  FileText,
  Banknote} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchName?: string;
}

export function MobileSidebar({ open, onOpenChange, branchName }: MobileSidebarProps) {
  const { sessionData } = useStationSession();
  const resolvedBranchName = branchName || (sessionData as any)?.branchName || sessionData?.branchCode || 'Branch';
  const pathname = usePathname();
  const { stationToken } = useStationSession();

  const navItems = [
    { id: 'dashboard',     label: 'Dashboard',    icon: LayoutDashboard, path: '/washstation/dashboard' },
    { id: 'orders',        label: 'Orders',        icon: ClipboardList,   path: '/washstation/orders' },
    { id: 'clock-in',      label: 'Clock In/Out',  icon: Clock,           path: '/washstation/clock-in' },
    { id: 'attendance',    label: 'Attendance',    icon: Clock,           path: '/washstation/attendance' },
    { id: 'transactions',  label: 'Transactions',  icon: CreditCard,      path: '/washstation/transactions' },
    // { id: 'activity',      label: 'Activity Log',  icon: Activity,        path: '/washstation/activity' },
    { id: 'inventory',     label: 'Inventory',     icon: Package,         path: '/washstation/inventory' },
    { id: 'reports',       label: 'Daily Report',  icon: FileText,        path: '/washstation/reports' },
    { id: 'reconciliation', label: 'Cash Reconciliation', icon: Banknote, path: '/washstation/reconciliation' },
  ];

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + '/');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Logo size="sm" />
          </SheetTitle>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const badgeCount = 0;
            
            return (
              <Link
                key={item.id}
                href={item.path}
                onClick={() => onOpenChange(false)}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${
                  active 
                    ? 'bg-primary text-primary-foreground font-medium' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {badgeCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className={`h-5 min-w-5 px-1.5 text-xs flex items-center justify-center ${
                      active ? 'bg-primary-foreground text-primary' : ''
                    }`}
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="p-3 border-t border-border">
          <Link
            href="/washstation/settings"
            onClick={() => onOpenChange(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/washstation/settings')
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </div>

        {/* Branch Info */}
        <div className="p-4 border-t border-border">
          
        </div>
      </SheetContent>
    </Sheet>
  );
}
