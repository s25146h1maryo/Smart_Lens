"use client";

import { Thread } from "@/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import CreateThreadModal from "../threads/CreateThreadModal"; // Reusing the modal
import { useSession } from "next-auth/react";
import { Plus, Hash, Folder } from "lucide-react";

export default function ThreadNavigation({ threads }: { threads: Thread[] }) {
    const pathname = usePathname();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { data: session } = useSession();
    
    // Check permission for "Add" button
    const userRole = session?.user?.role;
    const canCreate = userRole === "ROOT" || userRole === "ADMIN" || userRole === "TEACHER";

    return (
        <>
            <div className="w-20 md:w-64 flex flex-col h-full border-r border-white/5 bg-[#050510] relative">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="hidden md:block text-sm font-bold text-zinc-400 uppercase tracking-widest">プロジェクト</h2>
                    {canCreate && (
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="w-8 h-8 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white flex items-center justify-center transition-all"
                            title="新規スレッド作成"
                        >
                            <Plus size={16} />
                        </button>
                    )}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
                    {threads.map(thread => {
                        const isActive = pathname.startsWith(`/thread/${thread.id}`);
                        
                        return (
                            <Link 
                                key={thread.id} 
                                href={`/thread/${thread.id}`}
                                className={`
                                    group flex items-center gap-3 p-2 rounded-xl transition-all duration-200
                                    ${isActive ? 'bg-indigo-600/20 text-white' : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'}
                                `}
                            >
                                {/* Icon / Avatar */}
                                <div className={`
                                    w-10 h-10 min-w-10 rounded-full flex items-center justify-center font-bold text-lg border transition-colors
                                    ${isActive 
                                        ? 'bg-indigo-600 border-indigo-500' 
                                        : 'bg-zinc-900 border-white/10 group-hover:border-zinc-700'}
                                `}>
                                    {thread.title[0]}
                                </div>

                                {/* Title (Hidden on mobile/collapsed) */}
                                <div className="hidden md:block truncate">
                                    <div className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                                        {thread.title}
                                    </div>
                                </div>

                                {/* Active Indicator Bar */}
                                {isActive && (
                                    <div className="absolute left-0 w-1 h-8 bg-indigo-500 rounded-r-full" />
                                )}
                            </Link>
                        );
                    })}
                </div>
                
                {/* Footer Link to All Threads */}
                <div className="p-3 border-t border-white/5">
                     <Link 
                        href="/threads"
                        className="flex items-center gap-3 p-2 rounded-xl text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
                     >
                        <div className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-full border border-white/5">
                            <Folder size={18} />
                        </div>
                        <span className="hidden md:block text-xs font-medium">すべてのスレッド</span>
                     </Link>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && <CreateThreadModal onClose={() => setIsModalOpen(false)} />}
        </>
    );
}
