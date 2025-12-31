export type AttendanceStatus = '19:00' | '16:45' | 'NoST' | 'Home';

export interface AttendanceRecord {
    status: AttendanceStatus;
    userName: string;
    updatedAt: number;
}

export interface DailyAttendance {
    [userId: string]: AttendanceRecord;
}

export interface WeeklyAttendance {
    [dateStr: string]: DailyAttendance;
}

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
    '19:00': '19:00残',
    '16:45': '16:45残',
    'NoST': '校内不参加',
    'Home': '帰宅'
};

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
    '19:00': 'bg-indigo-600 text-white',
    '16:45': 'bg-blue-500 text-white',
    'NoST': 'bg-yellow-500 text-black',
    'Home': 'bg-zinc-700 text-zinc-300'
};

export interface AttendanceUser {
    id: string;
    name: string;
    email?: string;  // Made optional - not used in attendance UI
    image?: string;
    jobTitle?: string;
    role?: string;
}
