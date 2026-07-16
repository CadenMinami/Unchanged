import { CaseSessionProvider } from "@/components/case-session/case-session-provider";
import { TeacherReport } from "@/components/reporting/teacher-report";

export default function TeacherReportPage() {
  return (
    <CaseSessionProvider>
      <TeacherReport />
    </CaseSessionProvider>
  );
}
