"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { unstable_cache } from "next/cache";
import { format } from "date-fns";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

// RTDB URL for attendance
const RTDB_URL = "https://smartlens-facd7-default-rtdb.asia-southeast1.firebasedatabase.app";

function getAdminDatabase() {
    if (getApps().length === 0) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

        if (!projectId || !clientEmail || !privateKey) {
            throw new Error("Missing Firebase Admin credentials");
        }

        initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
            databaseURL: RTDB_URL,
        });
    }
    
    return getDatabase();
}

export interface DashboardStats {
    pendingTaskCount: number;
    todayDueTaskCount: number;
    todayEventCount: number;
    myTodoCount: number;
    myInProgressCount: number;
    myDoneCount: number;
    activeThreadCount: number;
    unreadMessageCount: number;
    attendanceUntil1645: number;
    attendanceUntil1900: number;
    isRoomOpen: boolean;
}

export interface HighPriorityTask {
    id: string;
    title: string;
    threadId: string;
    threadTitle: string;
    dueDate?: number | null;
    priority: string;
    status: string;
}

export interface RecentThread {
    id: string;
    title: string;
    description?: string;
    updatedAt: number;
}

export interface MyTaskSummary {
    todoCount: number;
    inProgressCount: number;
    doneCount: number;
    tasks: {
        id: string;
        title: string;
        threadId: string;
        threadTitle?: string;
        status: string;
        priority: string;
        dueDate?: number | null;
    }[];
}

export interface DashboardData {
    stats: DashboardStats;
    highPriorityTasks: HighPriorityTask[];
    recentThreads: RecentThread[];
    myTasks: MyTaskSummary;
    todayAttendees: {
        until1645: { id: string; name: string }[];
        until1900: { id: string; name: string }[];
        noST: { id: string; name: string }[];
        home: { id: string; name: string }[];
    };
    overallCompletion: number;
    myCompletion: number;
    allTasks: {
        id: string;
        title: string;
        threadId: string;
        threadTitle?: string;
        status: string;
        priority: string;
        dueDate?: number | null;
        startDate?: number | null;
        endDate?: number | null;
        assigneeIds?: string[];
    }[];
}

/**
 * Get comprehensive dashboard data with caching (30 second revalidation)
 */
const getCachedDashboardData = unstable_cache(
    async (userId: string): Promise<DashboardData> => {
        try {
            // Get today's date for filtering
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
            const todayStr = format(now, "yyyy-MM-dd");

            // Parallel fetch all required data
            const [
                tasksSnap,
                threadsSnap,
                roomStatusSnap,
                chatsSnap
            ] = await Promise.all([
                db.collection("tasks").get(),
                db.collection("threads").where("status", "==", "active").get(),
                db.collection("room_status").doc("current").get(),
                db.collection("chats").where("participants", "array-contains", userId).get()
            ]);

            // Build thread map for task titles
            const threadMap = new Map<string, string>();
            threadsSnap.docs.forEach(doc => {
                threadMap.set(doc.id, doc.data().title || "Unknown Thread");
            });

            // Get attendance from RTDB
            let attendanceUntil1645 = 0;
            let attendanceUntil1900 = 0;
            const until1645Users: { id: string; name: string }[] = [];
            const until1900Users: { id: string; name: string }[] = [];
            const noSTUsers: { id: string; name: string }[] = [];
            const homeUsers: { id: string; name: string }[] = [];
            
            try {
                const rtdb = getAdminDatabase();
                const attendanceSnap = await rtdb.ref(`attendance/${todayStr}`).once("value");
                const todayAttendance = attendanceSnap.val() || {};
                
                Object.entries(todayAttendance).forEach(([id, record]: [string, any]) => {
                    const name = record.userName || 'Unknown';
                    if (record.status === '16:45') {
                        attendanceUntil1645++;
                        until1645Users.push({ id, name });
                    } else if (record.status === '19:00') {
                        attendanceUntil1900++;
                        until1900Users.push({ id, name });
                    } else if (record.status === 'NoST') {
                        noSTUsers.push({ id, name });
                    } else if (record.status === 'Home') {
                        homeUsers.push({ id, name });
                    }
                });
            } catch (e) {
                console.log("Could not fetch attendance:", e);
            }

            // Process tasks
            const allTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            let pendingTaskCount = 0;
            let todayDueTaskCount = 0;
            let todayEventCount = 0;
            let myTodoCount = 0;
            let myInProgressCount = 0;
            let myDoneCount = 0;
            let totalTasks = 0;
            let completedTasks = 0;
            let myTotalTasks = 0;
            let myCompletedTasks = 0;
            
            const highPriorityTasks: HighPriorityTask[] = [];
            const myTasks: MyTaskSummary['tasks'] = [];

            allTasks.forEach((task: any) => {
                totalTasks++;
                if (task.status === 'done') completedTasks++;
                
                const isNotDone = task.status !== 'done';
                const dueDate = task.dueDate || task.startDate;
                const isDueToday = dueDate && dueDate >= todayStart && dueDate <= todayEnd;
                const isMyTask = task.assigneeIds?.includes(userId);

                // Pending tasks (not done)
                if (isNotDone) {
                    pendingTaskCount++;
                }

                // Today's due/scheduled tasks
                if (isNotDone && isDueToday) {
                    todayDueTaskCount++;
                    todayEventCount++;
                }

                // My tasks
                if (isMyTask) {
                    myTotalTasks++;
                    if (task.status === 'todo') myTodoCount++;
                    else if (task.status === 'in-progress') myInProgressCount++;
                    else if (task.status === 'done') {
                        myDoneCount++;
                        myCompletedTasks++;
                    }

                    if (task.status !== 'done') {
                        myTasks.push({
                            id: task.id,
                            title: task.title,
                            threadId: task.threadId,
                            threadTitle: threadMap.get(task.threadId) || "Unknown",
                            status: task.status,
                            priority: task.priority,
                            dueDate: task.dueDate
                        });
                    }
                }

                // High priority tasks (not done)
                if (isNotDone && task.priority === 'high') {
                    highPriorityTasks.push({
                        id: task.id,
                        title: task.title,
                        threadId: task.threadId,
                        threadTitle: threadMap.get(task.threadId) || "Unknown",
                        dueDate: task.dueDate,
                        priority: task.priority,
                        status: task.status
                    });
                }
            });

            // Sort high priority by due date (earliest first, null last)
            highPriorityTasks.sort((a, b) => {
                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate - b.dueDate;
            });

            // Unread messages
            let unreadMessageCount = 0;
            chatsSnap.docs.forEach(doc => {
                const data = doc.data();
                const unreadMap = data.unreadCounts || {};
                if (unreadMap[userId] && unreadMap[userId] > 0) {
                    unreadMessageCount += unreadMap[userId];
                }
            });

            // Recent threads - sorted by updatedAt
            const recentThreads = threadsSnap.docs
                .map(doc => ({
                    id: doc.id,
                    title: doc.data().title,
                    description: doc.data().description,
                    updatedAt: doc.data().updatedAt || 0
                }))
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(0, 6);

            // Room status
            const roomData = roomStatusSnap.data();
            const isRoomOpen = roomData?.isOpen ?? false;

            // Calculate completion rates
            const overallCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const myCompletion = myTotalTasks > 0 ? Math.round((myCompletedTasks / myTotalTasks) * 100) : 0;

            return {
                stats: {
                    pendingTaskCount,
                    todayDueTaskCount,
                    todayEventCount,
                    myTodoCount,
                    myInProgressCount,
                    myDoneCount,
                    activeThreadCount: threadsSnap.size,
                    unreadMessageCount,
                    attendanceUntil1645,
                    attendanceUntil1900,
                    isRoomOpen
                },
                highPriorityTasks: highPriorityTasks.slice(0, 5),
                recentThreads,
                myTasks: {
                    todoCount: myTodoCount,
                    inProgressCount: myInProgressCount,
                    doneCount: myDoneCount,
                    tasks: myTasks.sort((a, b) => (a.dueDate || Infinity) - (b.dueDate || Infinity)).slice(0, 5)
                },
                todayAttendees: {
                    until1645: until1645Users,
                    until1900: until1900Users,
                    noST: noSTUsers,
                    home: homeUsers
                },
                overallCompletion,
                myCompletion,
                allTasks: allTasks.map((task: any) => ({
                    id: task.id,
                    title: task.title,
                    threadId: task.threadId,
                    threadTitle: threadMap.get(task.threadId) || "Unknown",
                    status: task.status,
                    priority: task.priority,
                    dueDate: task.dueDate,
                    startDate: task.startDate,
                    endDate: task.endDate,
                    assigneeIds: task.assigneeIds || []
                }))
            };
        } catch (error) {
            console.error("getDashboardData Error:", error);
            return {
                stats: {
                    pendingTaskCount: 0,
                    todayDueTaskCount: 0,
                    todayEventCount: 0,
                    myTodoCount: 0,
                    myInProgressCount: 0,
                    myDoneCount: 0,
                    activeThreadCount: 0,
                    unreadMessageCount: 0,
                    attendanceUntil1645: 0,
                    attendanceUntil1900: 0,
                    isRoomOpen: false
                },
                highPriorityTasks: [],
                recentThreads: [],
                myTasks: { todoCount: 0, inProgressCount: 0, doneCount: 0, tasks: [] },
                todayAttendees: { until1645: [], until1900: [], noST: [], home: [] },
                overallCompletion: 0,
                myCompletion: 0,
                allTasks: []
            };
        }
    },
    ['dashboard_data'],
    { tags: ['dashboard'], revalidate: 30 }
);

/**
 * Public function to get dashboard data
 * Requires authentication
 */
export async function getDashboardData(): Promise<DashboardData> {
    const session = await auth();
    if (!session?.user?.id) {
        return {
            stats: {
                pendingTaskCount: 0,
                todayDueTaskCount: 0,
                todayEventCount: 0,
                myTodoCount: 0,
                myInProgressCount: 0,
                myDoneCount: 0,
                activeThreadCount: 0,
                unreadMessageCount: 0,
                attendanceUntil1645: 0,
                attendanceUntil1900: 0,
                isRoomOpen: false
            },
            highPriorityTasks: [],
            recentThreads: [],
            myTasks: { todoCount: 0, inProgressCount: 0, doneCount: 0, tasks: [] },
            todayAttendees: { until1645: [], until1900: [], noST: [], home: [] },
            overallCompletion: 0,
            myCompletion: 0,
            allTasks: []
        };
    }

    return getCachedDashboardData(session.user.id);
}

// Keep old function for backward compatibility
export async function getDashboardStats() {
    const data = await getDashboardData();
    return {
        pendingTaskCount: data.stats.pendingTaskCount,
        todayEventCount: data.stats.todayEventCount,
        activeThreadCount: data.stats.activeThreadCount,
        unreadMessageCount: data.stats.unreadMessageCount,
        onlineUserCount: data.stats.attendanceUntil1645 + data.stats.attendanceUntil1900
    };
}
