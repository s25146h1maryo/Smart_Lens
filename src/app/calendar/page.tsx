import { auth } from "@/auth";
import { getCalendarTasks } from "@/app/actions/calendar";
import { getActiveUsers } from "@/app/actions/user";
import { getExternalCalendarEvents } from "@/app/actions/externalCalendar";
import CalendarClient from "./CalendarClient";
import { redirect } from "next/navigation";

// Public High School Calendar
const SCHOOL_CAL_URL = "https://calendar.google.com/calendar/ical/hon1.ed.jp_1ovh5gpn10cdfqahjm33beto20%40group.calendar.google.com/public/basic.ics";

export default async function CalendarPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const [internalTasks, schoolEvents, users] = await Promise.all([
        getCalendarTasks(),
        getExternalCalendarEvents(SCHOOL_CAL_URL, '高校予定表'),
        getActiveUsers()
    ]);
    
    const externalTasks = schoolEvents.map(e => ({
        ...e,
        threadTitle: '高校予定表'
    }));

    return (
        <div className="flex h-screen bg-[#050510] text-white overflow-hidden">
             {/* Main Content */}
             <div className="flex-1 flex flex-col pl-[72px]"> {/* Sidebar offset */}
                <CalendarClient 
                    internalTasks={internalTasks} 
                    externalTasks={externalTasks}
                    userId={session.user.id} 
                    users={users} 
                />
            </div>
        </div>
    );
}
