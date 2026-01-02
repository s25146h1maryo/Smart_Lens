"use client";

import { useState } from "react";
import { approveUser, deleteUser, updateUserRole, rejectUser, updateUserJobTitle, updateUserGlobalTodoAccess } from "@/app/actions/user";
import { AlertTriangle, Users, Trash2, CheckCircle, XCircle, Ban, Edit2, ShieldAlert, ShieldCheck } from "lucide-react";

interface User {
    id: string;
    name: string;
    email: string;
    image?: string;
    jobTitle?: string;
    role?: string;
    allowGlobalTodo?: boolean;
}

export default function UserManagementClient({ users, currentUserRole }: { users: User[], currentUserRole: string }) {
    const [userList, setUserList] = useState(users);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const pendingUsers = userList.filter(u => u.role === "PENDING");
    const rejectedUsers = userList.filter(u => u.role === "REJECTED");
    const activeUsers = userList.filter(u => u.role !== "PENDING" && u.role !== "REJECTED");

    const handleApprove = async (uid: string) => {
        setIsSubmitting(true);
        try {
            await approveUser(uid, "USER"); // Default to USER
            // Optimistic update
            setUserList(prev => prev.map(u => u.id === uid ? { ...u, role: "USER" } : u));
        } catch (e: any) {
            alert(e.message || "承認に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async (uid: string) => {
        if (!confirm("このユーザーのリクエストを拒否しますか？")) return;
        setIsSubmitting(true);
        try {
            const res = await rejectUser(uid);
            if (!res.success) throw new Error(res.message);
            // Optimistic update - move to REJECTED
            setUserList(prev => prev.map(u => u.id === uid ? { ...u, role: "REJECTED" } : u));
        } catch (e: any) {
            alert(e.message || "拒否に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (uid: string) => {
        if (!confirm("このユーザーを完全に削除しますか？この操作は取り消せません。")) return;
         setIsSubmitting(true);
        try {
            const res = await deleteUser(uid);
            if (!res.success) throw new Error(res.message);
            setUserList(prev => prev.filter(u => u.id !== uid));
        } catch (e: any) {
            alert(e.message || "削除に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRoleChange = async (uid: string, newRole: string) => {
        if (!confirm(`権限を ${newRole} に変更しますか？`)) return;
        setIsSubmitting(true);
        try {
             // If trying to set TEACHER and not ROOT, action will fail, but good to block UI?
             // UI block is better but action handles it.
            const res = await updateUserRole(uid, newRole);
            if (!res.success) throw new Error(res.message);
            setUserList(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u));
        } catch (e: any) {
             alert(e.message || "権限の変更に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJobTitleChange = async (uid: string, currentJobTitle: string) => {
        const newJobTitle = prompt("新しい役職を入力してください:", currentJobTitle || "");
        if (newJobTitle === null) return;
        if (newJobTitle === currentJobTitle) return;
        
        setIsSubmitting(true);
        try {
            const res = await updateUserJobTitle(uid, newJobTitle);
            if (!res.success) throw new Error(res.message);
            setUserList(prev => prev.map(u => u.id === uid ? { ...u, jobTitle: newJobTitle || "未設定" } : u));
        } catch (e: any) {
            alert(e.message || "役職の変更に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAccessChange = async (uid: string, currentStatus: boolean | undefined) => {
        const newStatus = currentStatus === false ? true : false; // Toggle
        setIsSubmitting(true);
        try {
            const res = await updateUserGlobalTodoAccess(uid, newStatus);
            if (!res.success) throw new Error(res.message);
            setUserList(prev => prev.map(u => u.id === uid ? { ...u, allowGlobalTodo: newStatus } : u));
        } catch (e: any) {
            alert(e.message || "アクセス権の変更に失敗しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-12">
            {/* PENDING SECTION */}
            {pendingUsers.length > 0 && (
                <section>
                    <h2 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6" /> 承認待ちユーザー ({pendingUsers.length})
                    </h2>
                    <div className="grid gap-4">
                        {pendingUsers.map(user => (
                            <div key={user.id} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                                        {user.name[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{user.name}</div>
                                        <div className="text-sm text-zinc-400">{user.email}</div>
                                        <div className="text-xs text-amber-500/80 mt-1">承認待ち</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleReject(user.id)}
                                        disabled={isSubmitting}
                                        className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all flex items-center gap-1"
                                    >
                                        <XCircle size={14} /> 拒否
                                    </button>
                                    <button 
                                        onClick={() => handleApprove(user.id)}
                                        disabled={isSubmitting}
                                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center gap-1"
                                    >
                                        <CheckCircle size={14} /> 承認
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* REJECTED SECTION */}
            {rejectedUsers.length > 0 && (
                <section>
                    <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                        <Ban className="w-6 h-6" /> 拒否済みユーザー ({rejectedUsers.length})
                    </h2>
                    <div className="grid gap-4">
                        {rejectedUsers.map(user => (
                            <div key={user.id} className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-bold">
                                        {user.name[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{user.name}</div>
                                        <div className="text-sm text-zinc-400">{user.email}</div>
                                        <div className="text-xs text-red-500/80 mt-1">リクエスト拒否</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleRoleChange(user.id, "PENDING")}
                                        disabled={isSubmitting}
                                        className="px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-sm font-medium transition-all"
                                    >
                                        再審査
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(user.id)}
                                        disabled={isSubmitting}
                                        className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all flex items-center gap-1"
                                    >
                                        <Trash2 size={14} /> 完全削除
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ALL USERS SECTION */}
            <section>
                <div className="flex items-center justify-between mb-4">
                     <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Users className="w-6 h-6" /> ユーザー一覧
                    </h2>
                    {/* Search bar could go here */}
                </div>
               
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-black/20 text-zinc-400">
                            <tr>
                                <th className="p-4 font-medium">ユーザー</th>
                                <th className="p-4 font-medium">役職</th>
                                <th className="p-4 font-medium">権限</th>
                                <th className="p-4 font-medium text-center">Todoアクセス</th>
                                <th className="p-4 font-medium text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {activeUsers.map(user => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                                                {user.name[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">{user.name}</div>
                                                <div className="text-xs text-zinc-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-300">{user.jobTitle || "未設定"}</span>
                                            <button
                                                onClick={() => handleJobTitleChange(user.id, user.jobTitle || "")}
                                                disabled={isSubmitting}
                                                className="p-1 text-zinc-500 hover:text-indigo-400 transition-colors"
                                                title="役職を編集"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                         <span className={`
                                            inline-flex items-center px-2 py-1 rounded text-xs font-medium border
                                            ${user.role === 'ROOT' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                                              user.role === 'ADMIN' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                                              user.role === 'TEACHER' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                              'bg-zinc-800 border-zinc-700 text-zinc-400'}
                                         `}>
                                            {user.role || "USER"}
                                         </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleAccessChange(user.id, user.allowGlobalTodo)}
                                            disabled={isSubmitting}
                                            className={`
                                                relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                                                ${user.allowGlobalTodo !== false ? 'bg-indigo-600' : 'bg-zinc-700'}
                                            `}
                                            title={user.allowGlobalTodo !== false ? "アクセス許可中" : "アクセス制限中"}
                                        >
                                            <span
                                                className={`
                                                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                                    ${user.allowGlobalTodo !== false ? 'translate-x-6' : 'translate-x-1'}
                                                `}
                                            />
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        {user.role !== 'ROOT' && user.role !== 'TEACHER' && (
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Role Dropdown - No TEACHER option (ROOT only via integrity page) */}
                                                 <select 
                                                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
                                                    value={user.role || "USER"}
                                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                    disabled={isSubmitting}
                                                >
                                                    <option value="USER">USER</option>
                                                    <option value="ADMIN">ADMIN</option>
                                                </select>
                                                
                                                <button 
                                                    onClick={() => handleDelete(user.id)}
                                                    disabled={isSubmitting}
                                                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                                    title="強制削除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                        {user.role === 'ROOT' && <span className="text-xs text-zinc-600 italic">Protected</span>}
                                        {user.role === 'TEACHER' && <span className="text-xs text-emerald-600 italic">TEACHER (ROOT管理)</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
