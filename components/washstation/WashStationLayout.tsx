'use client';
import { useState, useEffect } from 'react';
import WashStationSidebar from './WashStationSidebar';
import { MobileSidebar } from './MobileSidebar';
import WashStationHeader from './WashStationHeader';
import { useOrders } from '@/context/OrderContext';
import { useStationSession } from '@/hooks/useStationSession';
import { useStationAttendance } from '@/hooks/useStationAttendance';

interface WashStationLayoutProps {
  children: React.ReactNode;
  title: string;
  terminalId?: string;
  pendingCount?: number;
  onNotificationClick?: () => void;
}

// --- Preload Paystack script the moment an attendant enters any washstation page.
// By the time they reach the payment screen the script is already loaded,
// so the popup opens instantly with no download delay.
function usePreloadPaystack() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).PaystackPop) return; // already loaded and ready
    if (document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')) return; // already injected
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);
    // No cleanup — intentionally keep script loaded for the whole session
  }, []);
}

export function WashStationLayout({
  children,
  title,
  terminalId,
  pendingCount,
  onNotificationClick,
}: WashStationLayoutProps) {
  usePreloadPaystack();

  const { getPendingOrders } = useOrders();
  const { stationToken, sessionData } = useStationSession();
  const { attendances } = useStationAttendance(stationToken);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const actualPendingCount =
    pendingCount !== undefined ? pendingCount : getPendingOrders().length;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (storedCollapsed === 'true') setCollapsed(true);
  }, []);

  const handleToggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', next.toString());
      return next;
    });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <WashStationSidebar
        collapsed={collapsed}
        onToggle={handleToggleCollapse}
      />
      <MobileSidebar
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
      />
      <main
        className={`flex-1 min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <WashStationHeader
          title={title}
          branchName={sessionData?.branchName}
          activeAttendances={attendances}
          pendingCount={actualPendingCount}
          onNotificationClick={onNotificationClick}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
