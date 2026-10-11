import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Receipt,
  School,
  Settings,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { href: "/students", label: "Students", icon: Users },
      { href: "/teachers", label: "Teachers", icon: UserRound },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/classes", label: "Classes & Years", icon: School },
      { href: "/subjects", label: "Subjects", icon: BookOpen },
      { href: "/batches", label: "Batches", icon: Layers },
      { href: "/timetable", label: "Timetable", icon: CalendarClock },
      { href: "/attendance", label: "Attendance", icon: CalendarCheck },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/fees", label: "Fees & Dues", icon: Wallet },
      { href: "/payments", label: "Payments", icon: Receipt },
    ],
  },
  {
    label: "Exams",
    items: [
      { href: "/exams", label: "Exams", icon: ClipboardList },
      { href: "/results", label: "Results", icon: FileSpreadsheet },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const BRAND_ICON = GraduationCap;
