import { getAllUsersWithEmail } from "@/app/actions/user";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import UserManagementClient from "./UserManagementClient";
import DownloadLogsButton from "../components/DownloadLogsButton";

export default async function AdminUsersPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    // Role check (Admin, Teacher, or Root can access this page)
    if (session.user.role !== "ADMIN" && session.user.role !== "ROOT" && session.user.role !== "TEACHER") {
        redirect("/dashboard");
    }

    const users = await getAllUsersWithEmail();

    return (
        <div className="min-h-screen bg-[#050510] text-white p-8 pl-[100px]"> {/* Padding for sidebar */}
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            User Management
                        </h1>
                        <p className="text-zinc-400 mt-1">Manage users, approvals, and system roles.</p>
                    </div>
                    <div>
                        <DownloadLogsButton />
                    </div>
                </header>

                <UserManagementClient users={users} currentUserRole={session.user.role} />
            </div>
        </div>
    );
}
