import { WashStationLayout } from '@/components/washstation/WashStationLayout';
import ReportsContent from '@/components/washstation/pages/ReportsContent';

export default function DailyReportPage() {
  return (
    <WashStationLayout title="Daily Report">
      <ReportsContent />
    </WashStationLayout>
  );
}
