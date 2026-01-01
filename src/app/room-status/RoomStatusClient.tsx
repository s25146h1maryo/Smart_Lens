"use client";

import { useRoomStatus } from "@/hooks/useRoomStatus";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { DoorOpen, DoorClosed, History, TrendingUp } from "lucide-react";

interface RoomStatusClientProps {
    currentUser: {
        id: string;
        name: string;
    };
}

export default function RoomStatusClient({ currentUser }: RoomStatusClientProps) {
    const { current, history, stats, loading, toggleStatus } = useRoomStatus();

    const isOpen = current?.isOpen ?? false;

    const handleToggle = async () => {
        await toggleStatus(currentUser.id, currentUser.name, !isOpen);
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-zinc-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-zinc-700 border-t-indigo-500 animate-spin"></div>
                    <div className="text-zinc-500">読み込み中...</div>
                </div>
            </div>
        );
    }

    const openRate = Math.round((stats.openCount / 30) * 100);

    return (
        <div className="flex-1 overflow-auto bg-zinc-950">
            {/* Centered Content Container */}
            <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-2xl space-y-8">
                    
                    {/* Main Status Display - Centered, Prominent */}
                    <div className="text-center space-y-8">
                        {/* Status Icon & Text */}
                        <div className="space-y-4">
                            <div className={`
                                inline-flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full transition-all duration-500
                                ${isOpen 
                                    ? 'bg-emerald-500/20 ring-4 ring-emerald-500/30' 
                                    : 'bg-red-500/20 ring-4 ring-red-500/30'}
                            `}>
                                {isOpen 
                                    ? <DoorOpen className="w-12 h-12 md:w-16 md:h-16 text-emerald-400" /> 
                                    : <DoorClosed className="w-12 h-12 md:w-16 md:h-16 text-red-400" />
                                }
                            </div>
                            
                            <div>
                                <div className={`text-4xl md:text-5xl font-bold mb-2 ${isOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {isOpen ? '開室中' : '閉室中'}
                                </div>
                                {current && (
                                    <div className="text-zinc-500">
                                        {current.updatedByName} さんが
                                        {format(current.updatedAt, " M/d HH:mm ", { locale: ja })}
                                        に変更
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Toggle Button */}
                        <button
                            onClick={handleToggle}
                            className={`
                                px-16 py-5 rounded-2xl text-xl font-bold transition-all duration-300 
                                transform hover:scale-105 active:scale-95
                                ${isOpen 
                                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-500/25' 
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-500/25'}
                            `}
                        >
                            {isOpen ? '閉室にする' : '開室にする'}
                        </button>
                    </div>

                    {/* Stats Bar - Compact, Horizontal */}
                    <div className="flex items-center justify-center gap-6 py-6 px-8 bg-zinc-900/50 rounded-2xl border border-white/5">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        <div className="text-zinc-400">直近30日</div>
                        <div className="text-3xl font-bold text-white">{stats.openCount}<span className="text-lg text-zinc-500">日</span></div>
                        <div className="w-px h-8 bg-zinc-700"></div>
                        <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, openRate)}%` }}
                                ></div>
                            </div>
                            <span className="text-indigo-300 font-semibold">{openRate}%</span>
                        </div>
                    </div>

                    {/* History - Clean List */}
                    <div className="bg-zinc-900/30 rounded-2xl border border-white/5 overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
                            <History className="w-4 h-4 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-400">変更履歴</span>
                        </div>
                        
                        <div className="divide-y divide-white/5 max-h-[280px] overflow-y-auto">
                            {history.length === 0 ? (
                                <div className="px-6 py-8 text-center text-zinc-600">
                                    履歴がありません
                                </div>
                            ) : (
                                history.map((record, index) => (
                                    <div 
                                        key={index}
                                        className="flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`
                                                w-2 h-2 rounded-full
                                                ${record.isOpen ? 'bg-emerald-400' : 'bg-red-400'}
                                            `}></div>
                                            <span className="text-zinc-300">{record.updatedByName}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`
                                                text-xs font-medium px-2 py-0.5 rounded
                                                ${record.isOpen 
                                                    ? 'bg-emerald-500/15 text-emerald-400' 
                                                    : 'bg-red-500/15 text-red-400'}
                                            `}>
                                                {record.isOpen ? '開室' : '閉室'}
                                            </span>
                                            <span className="text-xs text-zinc-600">
                                                {format(record.updatedAt, "M/d HH:mm", { locale: ja })}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
