import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getActiveUsers } from "@/app/actions/user";
import AttendanceClient from "./AttendanceClient";

export default async function AttendancePage() {
    const session = await auth();
    if (!session?.user) redirect("/login");
    // Handle potential PENDING role if your app requires it
    if ((session.user as any).role === 'PENDING') redirect("/pending");

    // Fetch all users to display in the team schedule
    const users = await getActiveUsers();

    return (
        <div className="h-screen w-full bg-zinc-950 overflow-hidden flex flex-col">
            <header className="px-8 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    出席管理表
                </h1>
            </header>
            
            <AttendanceClient 
                currentUser={session.user}
                users={users}
            />
        </div>
    );
}
