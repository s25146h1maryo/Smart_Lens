"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { Task, Thread } from "@/types";
import { unstable_cache } from "next/cache";

export interface TaskWithThread extends Task {
    threadTitle: string;
}

export interface WorkloadData {
    userId: string;
    userName: string;
    totalTasks: number;
    todoCount: number;
    inProgressCount: number;
    doneCount: number;
    highPriorityCount: number;
}

/**
 * Cached function to get active tasks (todo, in-progress, done)
 * Shared across all users for efficiency
 * Revalidates every 3 minutes or on tag invalidation
 */
const getCachedActiveTasks = unstable_cache(
    async (): Promise<TaskWithThread[]> => {
        // Get all threads (excluding hidden from GlobalTodo)
        const threadsSnap = await db.collection("threads")
            .where("status", "in", ["active", "pending"])
            .get();

        if (threadsSnap.empty) return [];

        const threadMap = new Map<string, string>();
        threadsSnap.docs.forEach(doc => {
            const data = doc.data() as Thread;
            if (!data.hiddenFromGlobalTodo) {
                threadMap.set(doc.id, data.title);
            }
        });

        // Get active tasks only (not archived)
        const tasksSnap = await db.collection("tasks")
            .where("status", "in", ["todo", "in-progress", "done"])
            .get();
        
        const tasks: TaskWithThread[] = [];
        tasksSnap.docs.forEach(doc => {
            const data = doc.data() as Task;
            const threadTitle = threadMap.get(data.threadId);
            if (threadTitle && data.title) {
                tasks.push({
                    ...data,
                    id: doc.id,
                    threadTitle
                });
            }
        });

        tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return tasks;
    },
    ['active_tasks_cache'],
    { tags: ['tasks'], revalidate: 30 }
);

/**
 * Cached function to get archived tasks
 * Used by InsightsView for "Fully Completed Tasks" display
 * Revalidates every 10 minutes (archived tasks change less frequently)
 */
const getCachedArchivedTasks = unstable_cache(
    async (): Promise<TaskWithThread[]> => {
        const threadsSnap = await db.collection("threads")
            .where("status", "in", ["active", "pending"])
            .get();

        if (threadsSnap.empty) return [];

        const threadMap = new Map<string, string>();
        threadsSnap.docs.forEach(doc => {
            const data = doc.data() as Thread;
            if (!data.hiddenFromGlobalTodo) {
                threadMap.set(doc.id, data.title);
            }
        });

        const tasksSnap = await db.collection("tasks")
            .where("status", "==", "archived")
            .get();
        
        const tasks: TaskWithThread[] = [];
        tasksSnap.docs.forEach(doc => {
            const data = doc.data() as Task;
            const threadTitle = threadMap.get(data.threadId);
            if (threadTitle && data.title) {
                tasks.push({
                    ...data,
                    id: doc.id,
                    threadTitle
                });
            }
        });

        return tasks;
    },
    ['archived_tasks_cache'],
    { tags: ['tasks'], revalidate: 60 }
);

/**
 * Get all tasks across all threads (excluding private threads)
 * Combines active and archived tasks from cache
 */
export async function getAllTasks(): Promise<TaskWithThread[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const [active, archived] = await Promise.all([
            getCachedActiveTasks(),
            getCachedArchivedTasks()
        ]);
        return [...active, ...archived];
    } catch (error) {
        console.error("getAllTasks Error:", error);
        return [];
    }
}

/**
 * Get only active tasks (performance-optimized for views that don't need archived)
 */
export async function getActiveTasks(): Promise<TaskWithThread[]> {
    const session = await auth();
    if (!session?.user?.id) return [];
    return getCachedActiveTasks();
}

/**
 * Get all threads for task creation dropdown (excluding private threads)
 */
export async function getAllThreads(): Promise<{ id: string; title: string }[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const snap = await db.collection("threads")
            .where("status", "in", ["active", "pending"])
            .get();

        // Filter hidden threads
        return snap.docs
            .map(doc => {
                const data = doc.data() as Thread;
                return { ...data, id: doc.id };
            })
            .filter(t => !t.hiddenFromGlobalTodo)
            .map(t => ({
                id: t.id,
                title: t.title
            }));
    } catch (error) {
        console.error("getAllThreads Error:", error);
        return [];
    }
}

/**
 * Get tasks for a specific date range
 */
export async function getTasksByDateRange(
    startDate: number,
    endDate: number
): Promise<TaskWithThread[]> {
    const allTasks = await getAllTasks(); // Reuses logic with hidden filter
    
    return allTasks.filter(task => {
        const taskStart = task.startDate || task.dueDate;
        const taskEnd = task.endDate || task.dueDate || taskStart;
        
        if (!taskStart) return false;
        
        // Check if task overlaps with date range
        return taskStart <= endDate && (taskEnd || taskStart) >= startDate;
    });
}

/**
 * Get members with no tasks on a specific date
 */
/**
 * Get members availability on a specific date (sorted by task count ASC)
 */
export async function getAvailableMembers(date: number): Promise<{ id: string; name: string; taskCount: number }[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        // Get all active users
        const usersSnap = await db.collection("users")
            .where("role", "not-in", ["PENDING", "REJECTED"])
            .get();

        const allUsers = usersSnap.docs.map(doc => ({
            id: doc.id,
            name: (doc.data().nickname || doc.data().displayName || "Unknown") as string
        }));

        // Get all tasks for this date
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const tasksOnDate = await getTasksByDateRange(dayStart.getTime(), dayEnd.getTime());

        // Count tasks per user
        const userTaskCounts = new Map<string, number>();
        allUsers.forEach(u => userTaskCounts.set(u.id, 0));

        tasksOnDate.forEach(task => {
            task.assigneeIds?.forEach(id => {
                if (userTaskCounts.has(id)) {
                    userTaskCounts.set(id, (userTaskCounts.get(id) || 0) + 1);
                }
            });
        });

        // Map and Sort (ASC - Least tasks first)
        const result = allUsers.map(u => ({
            id: u.id,
            name: u.name,
            taskCount: userTaskCounts.get(u.id) || 0
        })).sort((a, b) => a.taskCount - b.taskCount);

        return result;
    } catch (error) {
        console.error("getAvailableMembers Error:", error);
        return [];
    }
}

/**
 * Get tasks assigned to a specific user
 */
export async function getTasksByAssignee(userId: string): Promise<TaskWithThread[]> {
    const allTasks = await getAllTasks();
    return allTasks.filter(task => task.assigneeIds?.includes(userId));
}

/**
 * Get workload data for all users
 */
export async function getWorkloadData(): Promise<WorkloadData[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        // Get all users
        const usersSnap = await db.collection("users")
            .where("role", "not-in", ["PENDING", "REJECTED"])
            .get();

        const userMap = new Map<string, { name: string; data: WorkloadData }>();
        usersSnap.docs.forEach(doc => {
            const data = doc.data();
            userMap.set(doc.id, {
                name: data.nickname || data.displayName || "Unknown",
                data: {
                    userId: doc.id,
                    userName: data.nickname || data.displayName || "Unknown",
                    totalTasks: 0,
                    todoCount: 0,
                    inProgressCount: 0,
                    doneCount: 0,
                    highPriorityCount: 0
                }
            });
        });

        // Get all tasks and count (will exclude hidden threads)
        const allTasks = await getAllTasks();
        allTasks.forEach(task => {
            task.assigneeIds?.forEach(userId => {
                const userData = userMap.get(userId);
                if (userData) {
                    userData.data.totalTasks++;
                    if (task.status === 'todo') userData.data.todoCount++;
                    if (task.status === 'in-progress') userData.data.inProgressCount++;
                    if (task.status === 'done') userData.data.doneCount++;
                    if (task.priority === 'high') userData.data.highPriorityCount++;
                }
            });
        });

        return Array.from(userMap.values())
            .map(u => u.data)
            .sort((a, b) => b.totalTasks - a.totalTasks);
    } catch (error) {
        console.error("getWorkloadData Error:", error);
        return [];
    }
}
