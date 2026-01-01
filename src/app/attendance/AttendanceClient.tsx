"use client";

import { useState, useMemo } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { useWeekAttendance } from "@/hooks/useAttendance";
import { AttendanceStatus, STATUS_LABELS, STATUS_COLORS, AttendanceUser } from "@/types/attendance";
import { User, Check } from "lucide-react";

interface AttendanceClientProps {
    currentUser: any; 
    users: AttendanceUser[];
}

export default function AttendanceClient({ currentUser, users }: AttendanceClientProps) {
    // 1. Fixed Date Logic: Always Start from Today to show Next 7 Days
    const [startDate] = useState(startOfDay(new Date()));
    
    // 2. Data Hook
    const { attendance, updateAttendance, loading } = useWeekAttendance(startDate);
    
    // 3. UI State: Sorting
    const [sortConfig, setSortConfig] = useState<{ dateStr: string | null, direction: 'asc' | 'desc' }>({
        dateStr: null,
        direction: 'asc'
    });

    // 4. Generate Columns
    const dates = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(startDate, i)), [startDate]);

    // --- Helpers ---
    // Use the id property directly - this matches session.user.id set by auth.ts
    // which is the same as the Firestore document ID
    const currentUserId: string = currentUser?.id || "unknown";
    const currentUserName = currentUser.name || currentUser.nickname || "User";

    const STATUS_ORDER: AttendanceStatus[] = ['19:00', '16:45', 'NoST', 'Home'];
    
    const getStatusWeight = (status?: string) => {
        if (!status) return 999;
        const idx = STATUS_ORDER.indexOf(status as AttendanceStatus);
        return idx === -1 ? 999 : idx;
    };

    const handleStatusUpdate = async (date: Date, status: AttendanceStatus) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        // Update Firebase. The Hook's listener will update 'attendance' state, causing a re-render/glow update.
        await updateAttendance(dateStr, currentUserId, currentUserName, status);
    };

    const handleHeaderClick = (dateStr: string) => {
        setSortConfig(current => ({
            dateStr,
            direction: current.dateStr === dateStr && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // --- Computed Data: Other Users ---
    const otherUsers = useMemo(() => {
        return users
            .filter(u => u.id !== currentUserId)
            .sort((a, b) => {
                if (sortConfig.dateStr) {
                    const statusA = attendance[sortConfig.dateStr]?.[a.id]?.status;
                    const statusB = attendance[sortConfig.dateStr]?.[b.id]?.status;
                    const weightA = getStatusWeight(statusA);
                    const weightB = getStatusWeight(statusB);
                    
                    if (weightA !== weightB) {
                        return sortConfig.direction === 'asc' ? weightA - weightB : weightB - weightA;
                    }
                }
                return (a.name || "").localeCompare(b.name || "");
            });
    }, [users, currentUserId, attendance, sortConfig]);

    // --- Stats Calculation ---
    const myRate = useMemo(() => {
        let attended = 0;
        let totalWeekdays = 0;
        dates.forEach(date => {
            const day = date.getDay();
            if (day === 0 || day === 6) return; // Skip weekends
            totalWeekdays++;
            const dateStr = format(date, 'yyyy-MM-dd');
            const status = attendance[dateStr]?.[currentUserId]?.status;
            if (status === '19:00' || status === '16:45') attended++;
        });
        return totalWeekdays === 0 ? 0 : Math.round((attended / totalWeekdays) * 100);
    }, [dates, attendance, currentUserId]);

    return (
        <div className="flex-1 overflow-auto p-4 md:p-8 space-y-8 bg-zinc-950">
            {/* My Schedule Section */}
            <div className="bg-gradient-to-br from-indigo-900/40 to-zinc-900 border border-indigo-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none hidden md:block">
                     <User size={120} />
                </div>
                
                <div className="flex items-center justify-between mb-6 relative z-10 pt-10 md:pt-0 pl-10 md:pl-0">
                    <div>
                        <h2 className="text-xl font-bold text-indigo-100 flex items-center gap-2">
                            <span className="bg-indigo-500 w-1 h-6 rounded-full block"></span>
                            マイ・スケジュール
                        </h2>
                        <p className="text-zinc-400 text-sm mt-1">
                            {format(startDate, "yyyy年 M月 d日", { locale: ja })} 〜 {format(dates[6], "M月 d日", { locale: ja })}
                        </p>
                    </div>
                    <div className="text-right">
                         <div className="text-xs text-zinc-400 uppercase tracking-widest">Attendance Rate</div>
                         <div className="text-3xl font-bold text-indigo-300">{myRate}%</div>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-3 relative z-10">
                    {dates.map(date => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        
                        // Strict Status Check
                        const record = attendance[dateStr]?.[currentUserId];
                        const currentStatus = record?.status;

                        return (
                            <div key={dateStr} className={`
                                rounded-xl border p-3 flex flex-col gap-2 transition-all
                                ${isWeekend ? 'bg-zinc-900/30 border-white/5 opacity-60' : 'bg-zinc-800/60 border-white/10 hover:border-indigo-500/30'}
                            `}>
                                <div className={`text-center pb-2 border-b border-white/5 ${isWeekend ? 'text-red-400/70' : 'text-zinc-300'}`}>
                                    <div className="text-xs font-bold">{format(date, "M/d")}</div>
                                    <div className="text-[10px]">{format(date, "EEEE", { locale: ja })}</div>
                                </div>
                                
                                {!isWeekend ? (
                                    <div className="flex flex-col gap-2 flex-1 justify-center relative">
                                        {(['19:00', '16:45', 'NoST', 'Home'] as AttendanceStatus[]).map(status => {
                                            const isSelected = currentStatus === status;
                                            return (
                                                <button
                                                   key={status}
                                                   onClick={(e) => {
                                                       e.stopPropagation();
                                                       handleStatusUpdate(date, status);
                                                   }}
                                                       className={`
                                                       relative w-full text-[10px] sm:text-xs py-2 px-1 md:px-2 rounded-lg font-bold transition-all duration-200 border cursor-pointer flex items-center justify-between group overflow-hidden whitespace-nowrap
                                                       ${isSelected 
                                                           ? `${STATUS_COLORS[status]} border-white shadow-[0_0_15px_rgba(255,255,255,0.7)] ring-2 ring-white scale-[1.02] z-20` 
                                                           : 'bg-zinc-800/80 text-zinc-500 border-zinc-700/50 hover:bg-zinc-700 hover:text-zinc-300 hover:border-zinc-500 scale-100'}
                                                   `}
                                                >
                                                   {/* Glow Animation Layer for Selected */}
                                                   {isSelected && (
                                                       <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
                                                   )}

                                                   <span className="relative z-10 drop-shadow-sm">
                                                        <span className="md:hidden">{status === 'NoST' ? '校内' : STATUS_LABELS[status]}</span>
                                                        <span className="hidden md:inline">{STATUS_LABELS[status]}</span>
                                                   </span>
                                                   
                                                   {isSelected && (
                                                       <span className="relative z-10 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_white] animate-pulse" />
                                                   )}
                                                </button>
                                            );
                                        })}
                                        
                                        {/* Last Updated */}
                                        {record?.updatedAt && (
                                            <div className="mt-1 text-[9px] text-zinc-500 font-mono text-right flex justify-end items-center gap-1">
                                                <Check size={8} className="text-green-500" />
                                                {format(record.updatedAt, "HH:mm")}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs italic">
                                        休日
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Team Schedule Section */}
            <div>
                 <h3 className="text-lg font-bold text-zinc-300 mb-4 flex items-center gap-2">
                    <span className="bg-zinc-600 w-1 h-5 rounded-full block"></span>
                    メンバーの予定
                </h3>

                <div className="bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                    <div className="grid grid-cols-[100px_repeat(7,1fr)] md:grid-cols-[160px_repeat(7,1fr)] bg-zinc-950/80 border-b border-white/10">
                        <div className="p-2 md:p-3 text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center">Member</div>
                        {dates.map(date => {
                             const dateStr = format(date, 'yyyy-MM-dd');
                             const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                             const isSorting = sortConfig.dateStr === dateStr;

                             return (
                                <div 
                                    key={dateStr} 
                                    onClick={() => handleHeaderClick(dateStr)}
                                    className={`
                                        p-2 text-center border-l border-white/5 cursor-pointer hover:bg-white/5 transition-colors
                                        ${isWeekend ? 'bg-red-900/5 text-red-500/50' : 'text-zinc-400'}
                                        ${isSorting ? 'bg-indigo-900/20' : ''}
                                    `}
                                >
                                    <div className="text-[10px] font-bold flex flex-col items-center justify-center gap-1">
                                        <span>{format(date, "M/d (E)", { locale: ja })}</span>
                                        {isSorting && (
                                            <span className="text-[9px] text-indigo-400">
                                                {sortConfig.direction === 'asc' ? '▲' : '▼'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                             );
                        })}
                    </div>

                    <div className="max-h-[500px] overflow-y-auto">
                        {otherUsers.map(user => {
                            const userId = user.id;
                            return (
                                <div key={userId} className="grid grid-cols-[100px_repeat(7,1fr)] md:grid-cols-[160px_repeat(7,1fr)] border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <div className="p-2 md:p-3 flex items-center gap-2 md:gap-3 border-r border-white/5">
                                        {user.image ? (
                                            <img src={user.image} className="w-8 h-8 rounded-full border border-white/10" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                                                <User size={14} className="text-zinc-400" />
                                            </div>
                                        )}
                                        <div className="truncate text-sm text-zinc-300 font-medium">
                                            {user.name}
                                        </div>
                                    </div>

                                    {dates.map(date => {
                                        const dateStr = format(date, 'yyyy-MM-dd');
                                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                        const record = attendance[dateStr]?.[userId];
                                        const status = record?.status;

                                        return (
                                            <div key={dateStr} className={`border-l border-white/5 p-1 relative flex items-center justify-center ${isWeekend ? 'bg-zinc-950/30' : ''}`}>
                                                {status ? (
                                                    <div className={`
                                                        px-1 md:px-2 py-1 rounded text-[9px] md:text-[10px] font-bold shadow-sm whitespace-nowrap overflow-hidden text-ellipsis
                                                        ${STATUS_COLORS[status]}
                                                    `}>
                                                        <span className="md:hidden">
                                                            {status === 'NoST' ? '校内' : STATUS_LABELS[status].substring(0, 2)}
                                                        </span>
                                                        <span className="hidden md:inline">{STATUS_LABELS[status]}</span>
                                                    </div>
                                                ) : (
                                                    !isWeekend && <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
