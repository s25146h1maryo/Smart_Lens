import { Task } from "@/types";
import { isSameDay, startOfDay } from "date-fns";

export type CalendarEventSlot = 
    | { type: 'empty' }
    | { type: 'event', task: Task, isStart: boolean, isEnd: boolean, isContinued: boolean, span: number };

export function calculateCalendarLayout(days: Date[], tasks: Task[]): Record<string, CalendarEventSlot[]> {
    // 1. Sort tasks: Priority First (High->Low), then Start Time, then Duration
    const sortedTasks = [...tasks].sort((a, b) => {
        // Priority
        const pMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const pA = pMap[a.priority || 'low'] || 0;
        const pB = pMap[b.priority || 'low'] || 0;
        if (pA !== pB) return pB - pA; // High priority first

        // Start Time
        const startA = new Date(a.startDate || a.dueDate || 0).getTime();
        const startB = new Date(b.startDate || b.dueDate || 0).getTime();
        if (startA !== startB) return startA - startB;
        
        // Duration
        const durA = (a.endDate || a.startDate || 0) - (a.startDate || 0);
        const durB = (b.endDate || b.startDate || 0) - (b.startDate || 0);
        if (durA !== durB) return durB - durA; // Longest first
        
        return (a.title || "").localeCompare(b.title || "");
    });

    // Map: dateString -> Array of slots (indices)
    // We need to know which indices are occupied for each day.
    const dayOccupancy: Record<string, string[]> = {}; 
    const layout: Record<string, CalendarEventSlot[]> = {};

    // Initialize
    days.forEach(d => {
        const key = d.toISOString();
        dayOccupancy[key] = [];
        layout[key] = [];
    });

    sortedTasks.forEach(task => {
        // Determine effective visual range
        let s = task.startDate;
        let e = task.endDate;

        // If no start date but has due date, treat as a single-day item on due date
        if (!s && task.dueDate) {
            s = task.dueDate;
            e = task.dueDate;
        }

        if (!s) return;
        
        // Calculate span
        const start = startOfDay(new Date(s));
        const end = e ? startOfDay(new Date(e)) : start;
        
        // Find days this task covers strictly within the visible 'days' array
        const impactDayKeys: string[] = [];
        
        days.forEach(d => {
            const current = startOfDay(d);
            if (current.getTime() >= start.getTime() && current.getTime() <= end.getTime()) {
                impactDayKeys.push(d.toISOString());
            }
        });

        if (impactDayKeys.length === 0) return;

        // Find the lowest index available across ALL impacted days
        let targetIndex = 0;
        while (true) {
            // Check if ANY of the impacted days has this slot occupied
            const isBlocked = impactDayKeys.some(key => dayOccupancy[key][targetIndex]);
            if (!isBlocked) break;
            targetIndex++;
        }

        // Assign task to this index for all days
        impactDayKeys.forEach((key, i) => {
            dayOccupancy[key][targetIndex] = task.id;
            
            // Fill layout
            // Ensure array is big enough
            while (layout[key].length <= targetIndex) {
                layout[key].push({ type: 'empty' });
            }

            const currentDay = new Date(key);
            const isStart = isSameDay(currentDay, start);
            const isEnd = isSameDay(currentDay, end);
            
            layout[key][targetIndex] = {
                type: 'event',
                task,
                isStart,
                isEnd,
                isContinued: !isStart,
                span: 1 
            };
        });
    });

    return layout;
}
