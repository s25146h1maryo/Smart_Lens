"use client";

import { Thread, UserRole } from "@/types";
import { useState } from "react";
import CreateThreadModal from "./CreateThreadModal";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Users, Folder, LayoutGrid } from "lucide-react";

export default function ThreadListClient({ initialThreads }: { initialThreads: Thread[] }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { data: session } = useSession();
    const userRole = session?.user?.role as UserRole;
    
    // Only ROOT or ADMIN (or TEACHER?) can create threads. User asked for "ADOMIN" (ADMIN) or higher.
    const canCreate = userRole === "ROOT" || userRole === "ADMIN" || userRole === "TEACHER";

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">スレッド一覧</h1>
                    <p className="text-zinc-400 mt-1">進行中のプロジェクトスレッドを管理します。</p>
                </div>
                {canCreate && (
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={18} /> 新規スレッド作成
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {initialThreads.map((thread) => (
                    <Link 
                        key={thread.id} 
                        href={`/thread/${thread.id}`}
                        className="group bg-zinc-900/50 border border-white/5 p-6 rounded-2xl hover:bg-zinc-900 hover:border-indigo-500/30 transition-all duration-300"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg border border-white/5">
                                {thread.title[0]}
                            </div>
                            <span className="text-xs text-zinc-500 font-mono">
                                {new Date(thread.updatedAt).toLocaleDateString()}
                            </span>
                        </div>
                        
                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors line-clamp-1">
                            {thread.title}
                        </h3>
                        {/* Description removed as requested
                        <p className="text-sm text-zinc-400 line-clamp-2 h-10">
                            {thread.description || "No description provided."}
                        </p>
                        */}

                        <div className="mt-6 flex items-center gap-3 text-xs text-zinc-500">
                             <div className="flex items-center gap-1">
                                 <Users size={14} /> {thread.members.length} 名
                             </div>
                             <div className="flex items-center gap-1">
                                 <Folder size={14} /> 有効
                             </div>
                        </div>
                    </Link>
                ))}
            </div>

            {initialThreads.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                    <div className="text-4xl mb-4 flex justify-center"><LayoutGrid className="w-16 h-16 text-zinc-700" /></div>
                    <h3 className="text-xl font-bold text-white mb-2">スレッドがありません</h3>
                    <p className="text-zinc-400 max-w-sm mx-auto mb-6">
                        新しいスレッドを作成して、タスクやファイルを管理しましょう。
                    </p>
                    {canCreate && (
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                            新規スレッド作成 &rarr;
                        </button>
                    )}
                </div>
            )}

            {isModalOpen && <CreateThreadModal onClose={() => setIsModalOpen(false)} />}
        </div>
    );
}
