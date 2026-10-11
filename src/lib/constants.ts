export const APP_TIMEZONE = "Asia/Dhaka";

export type GradeRule = { grade: string; minPercent: number; gpa: number };

// Bangladesh national grading system (SSC/HSC), highest first.
export const DEFAULT_GRADING_SCALE: GradeRule[] = [
  { grade: "A+", minPercent: 80, gpa: 5.0 },
  { grade: "A", minPercent: 70, gpa: 4.0 },
  { grade: "A-", minPercent: 60, gpa: 3.5 },
  { grade: "B", minPercent: 50, gpa: 3.0 },
  { grade: "C", minPercent: 40, gpa: 2.0 },
  { grade: "D", minPercent: 33, gpa: 1.0 },
  { grade: "F", minPercent: 0, gpa: 0.0 },
];

export const DEFAULT_CLASS_LEVELS = [
  ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`),
  "SSC",
  "HSC",
];

export const WEEKDAYS = ["SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI"] as const;
export type WeekdayCode = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<WeekdayCode, string> = {
  SAT: "Saturday",
  SUN: "Sunday",
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
};

/** Weekday of a @db.Date value (UTC midnight of the calendar day). */
export function weekdayOf(date: Date): WeekdayCode {
  return WEEKDAYS[(date.getUTCDay() + 1) % 7];
}

export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT"] as const;
export type AttendanceCode = (typeof ATTENDANCE_STATUSES)[number];

export const FEE_TYPES = [
  { value: "ADMISSION", label: "Admission" },
  { value: "EXAM", label: "Exam" },
  { value: "MONTHLY_TUITION", label: "Monthly tuition" },
  { value: "OTHER", label: "Other" },
];
