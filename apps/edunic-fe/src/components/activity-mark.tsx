import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Mail,
  NotebookTabs,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

export type ActivityMarkKind =
  | 'assignment'
  | 'audit'
  | 'calendar'
  | 'exam'
  | 'homework'
  | 'message'
  | 'notification'
  | 'report'
  | 'risk';

type ActivityMarkProps = {
  kind: ActivityMarkKind;
  label?: string;
  tone?: 'default' | 'danger' | 'muted';
};

const icons: Record<ActivityMarkKind, LucideIcon> = {
  assignment: ClipboardList,
  audit: ShieldCheck,
  calendar: CalendarDays,
  exam: ClipboardCheck,
  homework: NotebookTabs,
  message: Mail,
  notification: Bell,
  report: FileText,
  risk: TriangleAlert,
};

export function ActivityMark({ kind, label, tone = 'default' }: ActivityMarkProps) {
  const Icon = icons[kind];

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className="activity-mark"
      data-tone={tone}
      role={label ? 'img' : undefined}
    >
      <Icon size={18} strokeWidth={2.3} />
    </span>
  );
}

export function getAssignmentActivityKind(type: string): ActivityMarkKind {
  const normalizedType = type.toLowerCase();

  if (normalizedType === 'homework') {
    return 'homework';
  }

  if (normalizedType === 'exam') {
    return 'exam';
  }

  return 'assignment';
}
