'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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
  ChevronLeft,
  ChevronRight,
  FileText,
  Banknote,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * WashStation Sidebar (Retractable)
 */
const WashStationSidebar = ({
  collapsed,
  onToggle,
}: SidebarProps) => {
  const pathname = usePathname();
  const { stationToken, sessionData } = useStationSession();
  const branchName = (sessionData as any)?.branchName || sessionData?.branchName || sessionData?.branchCode || 'Branch';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/washstation/dashboard' },
    { id: 'orders', label: 'Orders', icon: ClipboardList, path: '/washstation/orders' },
    { id: 'clock-in', label: 'Clock In/Out', icon: Clock, path: '/washstation/clock-in' },
    { id: 'attendance', label: 'Attendance', icon: Clock, path: '/washstation/attendance' },
    { id: 'transactions', label: 'Transactions', icon: CreditCard, path: '/washstation/transactions' },
    // { id: 'activity', label: 'Activity Log', icon: Activity, path: '/washstation/activity' },
    { id: 'inventory', label: 'Inventory', icon: Package, path: '/washstation/inventory' },
    { id: 'reports', label: 'Daily Report', icon: FileText, path: '/washstation/reports' },
    { id: 'reconciliation', label: 'Cash Reconciliation', icon: Banknote, path: '/washstation/reconciliation' },
  ];

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + '/');

  return (
    <aside
      className={`hidden lg:flex ${
        collapsed ? 'w-20' : 'w-64'
      } bg-card border-r border-border flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300`}
    >
      {/* Logo + Toggle */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <Link href="/washstation/dashboard" className="flex items-center">
         {!collapsed ? (
  <Image
    src="/assets/javis.png"  // ← updated
    alt="Javis"
    width={140}
    height={40}
    priority
    unoptimized
  />
) : (
  <Image
    src="/washlab-favicon1.png"  // ← stays the same
    alt="Javis"
    width={40}
    height={40}
    priority
    unoptimized
  />
)}
        </Link>

        <button
          onClick={onToggle}
          className="p-1 rounded-md hover:bg-muted"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                active
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-3 border-t border-border">
        <Link
          href="/washstation/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isActive('/washstation/settings')
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Settings className="w-5 h-5" />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
};

export default WashStationSidebar;
