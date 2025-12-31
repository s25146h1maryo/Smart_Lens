"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, CalendarDays, Pin } from "lucide-react";
import { calculateCalendarLayout } from "../utils/calendarLayout";
import { TaskWithThread } from "@/app/actions/global_todo";
import { Task } from "@/types";

interface CalendarViewProps {
    tasks: TaskWithThread[];
    currentDate: Date;
    onDateChange: (date: Date) => void; 
    onTaskClick: (task: TaskWithThread) => void;
    onAddClick: (date: Date) => void;
}

export default function CalendarView({ tasks, currentDate, onTaskClick, onAddClick }: CalendarViewProps) {
    
    // Derived Data: Full Calendar Grid
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); 
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Layout Calculation
    // Cast TaskWithThread[] to Task[] because layout doesn't care about threadTitle
    const layout = useMemo(() => {
        return calculateCalendarLayout(calendarDays, tasks as Task[]);
    }, [calendarDays, tasks]);

    const getTaskIcon = (task: Task) => {
        if (task.dueDate && !task.startDate) return <AlertCircle size={10} className="shrink-0" />;
        if (task.startDate && task.endDate && task.startDate !== task.endDate) return <CalendarDays size={10} className="shrink-0" />;
        return <Pin size={10} className="shrink-0" />;
    };

    const getTaskStyle = (task: Task & { isExternal?: boolean }, isStart: boolean, isEnd: boolean, date: Date) => {
        // Base
        let base = "h-5 text-[10px] flex items-center px-1 truncate mb-[1px] cursor-pointer transition-opacity relative z-10 font-medium";
        
        let colorClass = "";
        if (task.isExternal) {
            colorClass = "bg-slate-600 text-white hover:bg-slate-500 opacity-90";
        } else {
            switch (task.priority) {
                case 'high': colorClass = "bg-rose-600 text-white hover:bg-rose-500"; break;
                case 'medium': colorClass = "bg-amber-600 text-white hover:bg-amber-500"; break;
                case 'low': colorClass = "bg-emerald-600 text-white hover:bg-emerald-500"; break;
                default: colorClass = "bg-indigo-600 text-white hover:bg-indigo-500";
            }
        }

        let shapeClass = "";
        if (isStart) {
            shapeClass += " rounded-l ml-1";
        } else {
            shapeClass += " ml-[-1px] border-l border-white/20"; 
        }

        if (isEnd) {
            shapeClass += " rounded-r mr-1";
        } else {
            shapeClass += " mr-[-1px] border-r border-white/20";
        }

        // Show text if it's the start segment OR it's Sunday (visual break)
        const showText = isStart || date.getDay() === 0;

        return { className: `${base} ${colorClass} ${shapeClass}`, showText };
    };

    return (
        <div className="flex flex-col min-h-full bg-[#050510] border border-white/5">
            {/* Days Header */}
            <div className="grid grid-cols-7 gap-px bg-zinc-800/50 border-b border-white/5">
                {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                    <div key={day} className={`p-3 text-center text-xs font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-zinc-400'}`}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Days Body */}
            <div className="bg-zinc-900/30 flex-1 grid grid-cols-7 grid-rows-6 gap-px">
                {calendarDays.map(date => {
                    const dateKey = date.toISOString();
                    const slots = layout[dateKey] || [];
                    const isTodayDate = isToday(date);
                    const isCurrentMonth = isSameMonth(date, currentDate);
                    
                    return (
                        <div 
                            key={dateKey} 
                            className={`
                                relative transition-colors min-h-[140px] flex flex-col group
                                ${isCurrentMonth ? 'bg-transparent' : 'bg-black/40 text-zinc-700'}
                                hover:bg-white/[0.02]
                            `}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddClick(date);
                            }}
                        >
                            {/* Date Number Header */}
                            <div className="p-1.5 flex justify-between items-start">
                                <span className={`
                                    h-5 w-5 flex items-center justify-center rounded-full text-xs font-medium
                                    ${isTodayDate ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 
                                      isCurrentMonth ? 'text-zinc-400' : 'text-zinc-700'}
                                `}>
                                    {format(date, 'd')}
                                </span>
                            </div>

                            {/* Slots */}
                            <div 
                                className="flex-1 flex flex-col overflow-y-auto pb-1 relative custom-scrollbar scrollbar-none"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {slots.map((slot, i) => {
                                    if (slot.type === 'empty') {
                                        return <div key={`empty-${i}`} className="h-5 mb-[1px] shrink-0" />;
                                    }
                                    
                                    const { task, isStart, isEnd } = slot;
                                    const { className, showText } = getTaskStyle(task, isStart, isEnd, date);
                                    const icon = getTaskIcon(task);

                                    return (
                                        <div 
                                            key={`${task.id}-${i}`}
                                            className={`${className} shrink-0`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onTaskClick(task as TaskWithThread);
                                            }}
                                            title={task.title}
                                        >
                                            {showText && (
                                                <div className="flex items-center gap-0.5 overflow-hidden w-full">
                                                    {icon}
                                                    <span className="truncate sticky left-0 px-1">{task.title}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
