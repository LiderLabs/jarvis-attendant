import { WashStationLayout } from '@/components/washstation/WashStationLayout';
import { AttendanceContent } from '@/components/washstation/pages/AttendanceContent';

export default function AttendancePage() {
  return (
    <WashStationLayout title="Attendance">
      <AttendanceContent />
    </WashStationLayout>
  );
}
