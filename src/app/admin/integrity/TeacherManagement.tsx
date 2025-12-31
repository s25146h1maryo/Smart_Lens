"use client";

import { useState, useTransition } from "react";
import { updateUserRole } from "@/app/actions/user";
import { GraduationCap, ArrowUp, ArrowDown, Shield } from "lucide-react";

interface User {
    id: string;
    name: string;
    email: string;
    role?: string;
}

export default function TeacherManagement({ users }: { users: User[] }) {
    const [userList, setUserList] = useState(users);
    const [isPending, startTransition] = useTransition();

    const teachers = userList.filter(u => u.role === "TEACHER");
    const eligibleForPromotion = userList.filter(u => 
        u.role === "ADMIN" || u.role === "USER"
    );

    const handlePromote = (uid: string, name: string) => {
        if (!confirm(`${name} を TEACHER に昇格させますか？`)) return;
        
        startTransition(async () => {
            const res = await updateUserRole(uid, "TEACHER");
            if (res.success) {
                setUserList(prev => prev.map(u => 
                    u.id === uid ? { ...u, role: "TEACHER" } : u
                ));
            } else {
                alert(res.message || "昇格に失敗しました");
            }
        });
    };

    const handleDemote = (uid: string, name: string) => {
        if (!confirm(`${name} を ADMIN に降格させますか？`)) return;
        
        startTransition(async () => {
            const res = await updateUserRole(uid, "ADMIN");
            if (res.success) {
                setUserList(prev => prev.map(u => 
                    u.id === uid ? { ...u, role: "ADMIN" } : u
                ));
            } else {
                alert(res.message || "降格に失敗しました");
            }
        });
    };

    return (
        <div className="bg-emerald-950/20 border border-emerald-500/20 p-6 rounded-2xl mt-8">
            <h3 className="text-xl font-bold text-emerald-400 mb-2 flex items-center gap-2">
                <GraduationCap className="w-6 h-6" /> TEACHER 権限管理
            </h3>
            <p className="text-emerald-400/70 text-sm mb-4">
                TEACHER 権限の昇格・降格はこのページでのみ可能です。ROOT のみがこの操作を行えます。
            </p>

            {/* Current Teachers */}
            <div className="mb-6">
                <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> 現在の TEACHER ({teachers.length})
                </h4>
                {teachers.length === 0 ? (
                    <p className="text-zinc-500 text-sm">TEACHER がいません</p>
                ) : (
                    <div className="space-y-2">
                        {teachers.map(user => (
                            <div key={user.id} className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
                                <div>
                                    <span className="font-medium text-white">{user.name}</span>
                                    <span className="text-zinc-500 text-sm ml-2">{user.email}</span>
                                </div>
                                <button
                                    onClick={() => handleDemote(user.id, user.name)}
                                    disabled={isPending}
                                    className="px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-sm font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                                >
                                    <ArrowDown size={14} /> ADMIN に降格
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Promote Section */}
            <div>
                <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                    <ArrowUp className="w-4 h-4" /> TEACHER に昇格可能なユーザー
                </h4>
                {eligibleForPromotion.length === 0 ? (
                    <p className="text-zinc-500 text-sm">昇格可能なユーザーがいません</p>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {eligibleForPromotion.map(user => (
                            <div key={user.id} className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
                                <div>
                                    <span className="font-medium text-white">{user.name}</span>
                                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                                        user.role === 'ADMIN' 
                                            ? 'bg-indigo-500/20 text-indigo-400' 
                                            : 'bg-zinc-700 text-zinc-400'
                                    }`}>
                                        {user.role}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handlePromote(user.id, user.name)}
                                    disabled={isPending}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                                >
                                    <ArrowUp size={14} /> TEACHER に昇格
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
