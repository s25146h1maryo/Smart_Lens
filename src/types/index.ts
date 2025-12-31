export type UserRole = "ROOT" | "TEACHER" | "ADMIN" | "USER" | "PENDING" | "REJECTED";

export interface UserStats {
    attendanceCount: number;
}

export interface UserStatus {
    location: string; // e.g., "Student Council Room", "Classroom 3-B"
    availability: string; // e.g., "Available", "Busy", "In Class"
}

export interface UserProfile {
    uid: string;
    id?: string; // Alias for uid created by getAllUsers
    email: string;
    role: UserRole;
    jobTitle: string; // e.g., "President", "Secretary", "Member"
    displayName?: string;
    nickname?: string; // User-set display name, preferred over displayName
    name?: string; // Alias for displayName created by getAllUsers
    image?: string; // Profile picture URL
    status: UserStatus;
    stats: UserStats;
    createdAt: number; // Timestamp
    updatedAt: number; // Timestamp
}

export type ThreadStatus = "creating" | "pending" | "active" | "archived";

export interface ThreadMember {
    uid: string;
    role: "owner" | "editor" | "viewer"; // Simple permission model within app logic (distinct from Drive ACL)
}

export interface Thread {
    id: string;
    title: string;
    description?: string;
    status: ThreadStatus;
    driveFolderId?: string;
    createdBy: string; // User UID
    createdAt: number; // Timestamp
    updatedAt: number;
    members: string[]; // List of User UIDs for quick lookup
    memberDetails?: ThreadMember[]; // Optional, for detailed views
    hiddenFromGlobalTodo?: boolean; // If true, tasks from this thread are hidden in Global Todo
}

export interface Task {
    id: string;
    threadId: string;
    title: string;
    description?: string;
    status: 'todo' | 'in-progress' | 'done' | 'archived';
    priority: 'low' | 'medium' | 'high';
    startDate?: number | null; // Timestamp
    endDate?: number | null; // Timestamp
    dueDate?: number | null; // Timestamp
    assigneeIds: string[]; // List of User UIDs
    isAllDay?: boolean; // If true, ignore time components of dates
    attachments: {
        name: string;
        driveFileId: string;
        mimeType: string;
        webViewLink: string;
    }[];
    driveFolderId?: string;
    createdAt: number;
    updatedAt?: number;
}

// Drive API Types Helper
export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    iconLink: string;
    thumbnailLink?: string;
}
