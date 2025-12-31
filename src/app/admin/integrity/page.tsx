import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { redirect } from "next/navigation";
import { getAuditLogs, AuditAction } from "@/lib/audit";
import { SystemResetButton } from "./SystemResetButton";
import TeacherManagement from "./TeacherManagement";
import { getAllUsersWithEmail } from "@/app/actions/user";

export default async function IntegrityPage() {
    const session = await auth();
    // 1. Strict Access Control
    if (session?.user?.role !== "ROOT") {
        return <div className="p-10 text-red-500">Access Denied: ROOT privileges required.</div>;
    }

    // 2. Fetch Logs and Users (Admin context - includes email)
    const [logs, users] = await Promise.all([
        getAuditLogs(100),
        getAllUsersWithEmail()
    ]);

    return (
        <div className="max-w-6xl mx-auto py-10 px-6">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <span className="text-emerald-400">🛡️</span> 
                System Integrity & Audit
            </h1>
            <p className="text-zinc-400 mb-8">Monitor file system events and detect unauthorized changes.</p>

            {/* Stats / Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-zinc-900 border border-white/5 p-6 rounded-2xl">
                    <div className="text-zinc-500 text-sm font-medium">Total Events (24h)</div>
                    <div className="text-3xl font-bold text-white mt-2">{logs.length}</div>
                </div>
                <div className="bg-zinc-900 border border-white/5 p-6 rounded-2xl">
                    <div className="text-zinc-500 text-sm font-medium">Tamper Alerts</div>
                    <div className="text-3xl font-bold text-red-400 mt-2">
                        {logs.filter(l => l.action === "TAMPER_DETECTED").length}
                    </div>
                </div>
                <div className="bg-zinc-900 border border-white/5 p-6 rounded-2xl">
                    <div className="text-zinc-500 text-sm font-medium">System Status</div>
                    <div className="text-3xl font-bold text-emerald-400 mt-2">Secure</div>
                </div>
            </div>

            {/* Log Table */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm text-zinc-400">
                    <thead className="bg-zinc-900/80 text-zinc-200 border-b border-white/5">
                        <tr>
                            <th className="p-4 font-medium">Time</th>
                            <th className="p-4 font-medium">Action</th>
                            <th className="p-4 font-medium">User</th>
                            <th className="p-4 font-medium">Target</th>
                            <th className="p-4 font-medium">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td className="p-4">
                                    <Badge action={log.action} />
                                </td>
                                <td className="p-4 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs text-white">
                                        {log.userName?.[0] || "?"}
                                    </div>
                                    <span className="text-white">{log.userName}</span>
                                </td>
                                <td className="p-4 text-zinc-300">
                                    {log.targetName}
                                </td>
                                <td className="p-4 font-mono text-xs text-zinc-500 max-w-xs truncate">
                                    {JSON.stringify(log.metadata)}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-zinc-600">
                                    No logs found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* TEACHER Management - ROOT Only */}
            <TeacherManagement users={users} />
            
            <SystemResetButton />
        </div>
    );
}

function Badge({ action }: { action: AuditAction }) {
    const styles: Record<string, string> = {
        THREAD_CREATE: "bg-green-500/10 text-green-400 border-green-500/20",
        GROUP_CREATE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        TASK_CREATE: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        SYSTEM_RESET: "bg-red-500/10 text-red-400 border-red-500/20",
        TAMPER_DETECTED: "bg-red-500 text-white border-red-600 font-bold animate-pulse",
        USER_ROLE_CHANGE: "bg-amber-500/10 text-amber-400 border-amber-500/20"
    };

    return (
        <span className={`px-2 py-1 rounded-md border text-xs font-medium ${styles[action] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
            {action}
        </span>
    );
}
