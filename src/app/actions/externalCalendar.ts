"use server";

import ical from 'node-ical';
import { Task } from "@/types";

export async function getExternalCalendarEvents(url: string, label: string): Promise<(Task & { isExternal: true, externalLabel: string })[]> {
    try {
        const events = await ical.async.fromURL(url);
        const taskList: (Task & { isExternal: true, externalLabel: string })[] = [];

        for (const [key, event] of Object.entries(events)) {
            if (event.type === 'VEVENT') {
                const start = event.start ? new Date(event.start).getTime() : undefined;
                const end = event.end ? new Date(event.end).getTime() : undefined;
                
                // If it's a full day event, end date is usually +1 day in iCal. 
                // Our logic uses inclusive ranges? Or startOfDay logic?
                // Our Task logic: startDate, endDate.
                // If full day, our layoutUtils does: startOfDay(start) to startOfDay(end).
                // If iCal says 2023-01-01 to 2023-01-02 (full day), that's 1 day spread.
                
                if (start) {
                    const isAllDay = event.datetype === 'date';
                    taskList.push({
                        id: `ext-${event.uid}`,
                        title: event.summary || 'No Title',
                        description: event.description,
                        startDate: start,
                        endDate: end,
                        dueDate: undefined,
                        priority: 'low', // default, hidden in UI
                        status: 'todo',
                        assigneeIds: [],
                        attachments: [],
                        threadId: 'external',
                        isExternal: true,
                        externalLabel: label,
                        isAllDay,
                        createdAt: Date.now(),
                    });
                }
            }
        }
        return taskList;
    } catch (e) {
        console.error("Failed to fetch external calendar:", e);
        return [];
    }
}
