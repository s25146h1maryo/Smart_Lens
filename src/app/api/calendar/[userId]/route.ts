import { NextRequest, NextResponse } from "next/server";
import { db as adminDb } from "@/lib/firebase";
import ical from "ical-generator";
import { Task } from "@/types";
import crypto from "crypto";

// Helper function to validate calendar token (constant-time comparison)
async function validateToken(userId: string, token: string): Promise<boolean> {
    if (!userId || !token) return false;
    
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    if (!userData?.calendarToken) return false;
    
    try {
        return crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(userData.calendarToken)
        );
    } catch {
        return false;
    }
}

export async function GET(
    request: NextRequest, 
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;

    if (!userId) {
        return new NextResponse("User ID is required", { status: 400 });
    }

    // SECURITY: Validate token from query parameter
    const token = request.nextUrl.searchParams.get("token");
    
    if (!token) {
        return new NextResponse("Authentication token required. Please get your calendar URL from the settings page.", { status: 401 });
    }

    const isValid = await validateToken(userId, token);
    if (!isValid) {
        return new NextResponse("Invalid or expired token", { status: 403 });
    }

    try {
        const userDoc = await adminDb.collection("users").doc(userId).get();
        const userName = userDoc.exists ? (userDoc.data()?.nickname || "User") : "Smart Lens";

        const tasksSnapshot = await adminDb
            .collection("tasks")
            .where("assigneeIds", "array-contains", userId)
            .get();

        const tasks = tasksSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Task[];

        // Configure iCal Generator
        // Google Calendar insists on X-WR-TIMEZONE for accurate display in some contexts
        const calendar = ical({
            name: `${userName}'s Smart Lens Calendar`,
            prodId: { company: 'Smart Lens', product: 'Calendar', language: 'JA' },
            timezone: 'Asia/Tokyo', 
            events: []
        });

        // Add X-WR-TIMEZONE explicitly if ical-generator doesn't auto-add it (it usually does with `timezone` prop)
        // But let's rely on `timezone` prop.

        tasks.forEach(task => {
            let start: Date | null = null;
            let end: Date | null = null;
            // Default `isAllDay` to true for legacy compatibility
            const isAllDay = task.isAllDay ?? true;
            let allDay = isAllDay;

            if (task.startDate) {
                start = new Date(task.startDate);
                
                if (task.endDate) {
                    end = new Date(task.endDate);
                    if (isAllDay) {
                        // All Day events: End date is exclusive in iCal
                        // Add 1 day to inclusive endDate
                        end = new Date(end.getTime() + 86400000); 
                    } else {
                        // Timed events: Ensure end > start
                        if (end <= start) {
                            end = new Date(start.getTime() + 3600000); // +1 hour
                        }
                    }
                } else {
                    // Start Only
                    if (!isAllDay) {
                        // Default duration 1 hour for timed tasks
                        end = new Date(start.getTime() + 3600000);
                    }
                }
            } else if (task.dueDate) {
                // Deadline only -> Treat as All Day
                start = new Date(task.dueDate);
                allDay = true;
                end = null; 
            }

            if (start) {
                calendar.createEvent({
                    id: task.id,
                    summary: `[${task.status === 'done' ? '✓ ' : ''}${task.priority ? task.priority.toUpperCase() : ''}] ${task.title}`,
                    description: `${task.description || '(No Description)'}\n\nStatus: ${task.status}\nURL: ${new URL(`/thread/${task.threadId}`, request.url).toString()}`,
                    start: start,
                    end: end || undefined,
                    allDay: allDay,
                    url: `https://smart-lens.vercel.app/thread/${task.threadId}`,
                    timezone: allDay ? undefined : 'Asia/Tokyo',
                });
            }
        });

        return new NextResponse(calendar.toString(), {
            status: 200,
            headers: {
                "Content-Type": "text/calendar; charset=utf-8",
                "Content-Disposition": `attachment; filename="smart-lens-calendar.ics"`,
            },
        });

    } catch (error) {
        console.error("Failed to generate iCal:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
