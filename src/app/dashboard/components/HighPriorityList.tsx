"use client";

import Link from "next/link";
import { Thread } from "@/types";

export default function HighPriorityList({ threads }: { threads: Thread[] }) {
    // Filter logic would ideally be Task-based, but for now using Thread status
    const activeThreads = threads.filter(t => t.status === 'active').slice(0, 3);

    return (
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-6 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="flex justify-between items-center mb-4 relative z-10">
                <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                    <span className="text-indigo-400">⚡</span> High Priority
                </h3>
                <span className="text-xs font-mono text-zinc-500 bg-zinc-900/50 px-2 py-1 rounded">3 PENDING</span>
            </div>

            <div className="flex-1 flex flex-col gap-3 relative z-10">
                {activeThreads.length > 0 ? (
                    activeThreads.map(thread => (
                        <Link href={`/thread/${thread.id}`} key={thread.id} className="group/item flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer">
                            <div className="w-1 h-8 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-zinc-200 truncate group-hover/item:text-indigo-300 transition-colors">
                                    {thread.title}
                                </div>
                                <div className="text-xs text-zinc-500 truncate">
                                    {thread.description || "No description"}
                                </div>
                            </div>
                            <div className="text-xs text-zinc-600 whitespace-nowrap">
                                {new Date(thread.updatedAt).toLocaleDateString()}
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                         <div className="text-4xl mb-2">🎉</div>
                         <div className="text-zinc-300 font-medium">All caught up!</div>
                         <div className="text-xs text-zinc-500 max-w-[200px]">No high priority tasks pending. Take a break!</div>
                    </div>
                )}
            </div>
            
            <div className="mt-4 pt-3 border-t border-white/5 text-center">
                 <Link href="/threads" className="text-xs text-zinc-400 hover:text-white transition-colors uppercase tracking-wider font-semibold">
                    View All Activity →
                 </Link>
            </div>
        </div>
    );
}
