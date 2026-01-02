import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllTasks, getAllThreads, getWorkloadData } from "@/app/actions/global_todo";
import { getCachedUsers, getUserGlobalTodoAccess } from "@/app/actions/user";
import { getExternalCalendarEvents } from "@/app/actions/externalCalendar";
import GlobalTodoClient from "./GlobalTodoClient";

const SCHOOL_CAL_URL = "https://calendar.google.com/calendar/ical/hon1.ed.jp_1ovh5gpn10cdfqahjm33beto20%40group.calendar.google.com/public/basic.ics";

export default async function GlobalTodoPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");
    if ((session.user as any).role === 'PENDING') redirect("/pending");

    // 1. Check access FIRST before loading heavy data
    const canAccess = await getUserGlobalTodoAccess(session.user.id);

    // 2. If no access, pass empty data to client (no heavy fetch)
    if (!canAccess) {
        return (
            <GlobalTodoClient 
                initialTasks={[]}
                threads={[]}
                users={[]}
                workload={{}}
                schoolEvents={[]}
                currentUser={{
                    id: session.user.id,
                    name: session.user.name || "User",
                    allowGlobalTodo: false
                }}
            />
        );
    }

    // 3. Only fetch heavy data if access is granted
    const [tasks, threads, users, workload, schoolEvents] = await Promise.all([
        getAllTasks(),
        getAllThreads(),
        getCachedUsers(),
        getWorkloadData(),
        getExternalCalendarEvents(SCHOOL_CAL_URL, '高校予定表')
    ]);

    return (
        <GlobalTodoClient 
            initialTasks={tasks}
            threads={threads}
            users={users}
            workload={workload}
            schoolEvents={schoolEvents}
            currentUser={{
                id: session.user.id,
                name: session.user.name || "User",
                allowGlobalTodo: true
            }}
        />
    );
}

