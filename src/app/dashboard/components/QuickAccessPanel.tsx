"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { 
    CheckSquare, 
    Calendar, 
    MessageSquare, 
    FolderOpen, 
    Users, 
    Mail, 
    Settings,
    Sparkles,
    LucideIcon
} from "lucide-react";
import { DashboardStats } from "@/app/actions/dashboard";

interface QuickAccessCardProps {
    icon: LucideIcon;
    label: string;
    href: string;
    stat?: string | number;
    statLabel?: string;
    gradient: string;
    glowColor: string;
    size?: "large" | "medium" | "small";
    delay?: number;
}

function QuickAccessCard({ 
    icon: Icon, 
    label, 
    href, 
    stat, 
    statLabel,
    gradient, 
    glowColor,
    size = "medium",
    delay = 0
}: QuickAccessCardProps) {
    const sizeClasses = {
        large: "col-span-2 row-span-2 min-h-[200px]",
        medium: "col-span-1 row-span-1 min-h-[100px]",
        small: "col-span-1 row-span-1 min-h-[80px]"
    };

    const iconSizes = {
        large: "w-12 h-12",
        medium: "w-8 h-8",
        small: "w-6 h-6"
    };

    const textSizes = {
        large: "text-xl",
        medium: "text-sm",
        small: "text-xs"
    };

    const statSizes = {
        large: "text-4xl",
        medium: "text-2xl",
        small: "text-lg"
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1, duration: 0.4, ease: "easeOut" }}
            className={sizeClasses[size]}
        >
            <Link href={href} className="block h-full">
                <motion.div
                    whileHover={{ 
                        scale: 1.02,
                        boxShadow: `0 0 30px ${glowColor}40, 0 0 60px ${glowColor}20`
                    }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                        relative h-full p-5 rounded-2xl
                        bg-white/5 backdrop-blur-md
                        border border-white/10
                        hover:border-white/20 hover:bg-white/[0.08]
                        transition-all duration-300
                        cursor-pointer overflow-hidden
                        flex flex-col justify-between
                        group
                    `}
                >
                    {/* Background Gradient Orb */}
                    <div 
                        className={`
                            absolute -top-10 -right-10 w-32 h-32 
                            rounded-full blur-3xl opacity-20
                            group-hover:opacity-40 transition-opacity duration-500
                            pointer-events-none
                            ${gradient}
                        `}
                    />

                    {/* Icon Container */}
                    <div className={`
                        relative z-10 w-fit p-3 rounded-xl
                        bg-gradient-to-br ${gradient}
                        shadow-lg
                    `}>
                        <Icon className={`${iconSizes[size]} text-white`} />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 mt-auto">
                        {stat !== undefined && (
                            <div className={`${statSizes[size]} font-bold text-white mb-1`}>
                                {stat}
                                {statLabel && (
                                    <span className="text-xs text-zinc-400 ml-1 font-normal">
                                        {statLabel}
                                    </span>
                                )}
                            </div>
                        )}
                        <div className={`${textSizes[size]} font-medium text-zinc-300 group-hover:text-white transition-colors`}>
                            {label}
                        </div>
                    </div>

                    {/* Hover Arrow */}
                    <motion.div
                        className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        initial={{ x: -10 }}
                        whileHover={{ x: 0 }}
                    >
                        <span className="text-white/50 text-lg">→</span>
                    </motion.div>
                </motion.div>
            </Link>
        </motion.div>
    );
}

interface QuickAccessPanelProps {
    stats: DashboardStats;
}

export default function QuickAccessPanel({ stats }: QuickAccessPanelProps) {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-semibold text-zinc-100">クイックアクセス</h2>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-4 lg:grid-cols-6 gap-4 auto-rows-min">
                {/* Large Cards - Most Important Features */}
                <QuickAccessCard
                    icon={CheckSquare}
                    label="タスク管理"
                    href="/todo"
                    stat={stats.pendingTaskCount}
                    statLabel="件未完了"
                    gradient="from-violet-500 to-purple-600"
                    glowColor="#8b5cf6"
                    size="large"
                    delay={0}
                />
                
                <QuickAccessCard
                    icon={Calendar}
                    label="カレンダー"
                    href="/calendar"
                    stat={stats.todayEventCount}
                    statLabel="件今日"
                    gradient="from-cyan-500 to-blue-600"
                    glowColor="#06b6d4"
                    size="large"
                    delay={1}
                />

                {/* Medium Cards - Secondary Features */}
                <QuickAccessCard
                    icon={MessageSquare}
                    label="スレッド"
                    href="/threads"
                    stat={stats.activeThreadCount}
                    statLabel="件"
                    gradient="from-emerald-500 to-teal-600"
                    glowColor="#10b981"
                    size="medium"
                    delay={2}
                />

                <QuickAccessCard
                    icon={Mail}
                    label="メッセージ"
                    href="/messages"
                    stat={stats.unreadMessageCount > 0 ? stats.unreadMessageCount : undefined}
                    statLabel={stats.unreadMessageCount > 0 ? "件未読" : undefined}
                    gradient="from-rose-500 to-pink-600"
                    glowColor="#f43f5e"
                    size="medium"
                    delay={3}
                />

                <QuickAccessCard
                    icon={Users}
                    label="部屋状況"
                    href="/room-status"
                    stat={stats.attendanceUntil1645 + stats.attendanceUntil1900}
                    statLabel="人在室"
                    gradient="from-amber-500 to-orange-600"
                    glowColor="#f59e0b"
                    size="medium"
                    delay={4}
                />

                <QuickAccessCard
                    icon={FolderOpen}
                    label="ドライブ"
                    href="/drive"
                    gradient="from-indigo-500 to-blue-600"
                    glowColor="#6366f1"
                    size="medium"
                    delay={5}
                />

                {/* Small Card - Settings */}
                <QuickAccessCard
                    icon={Settings}
                    label="設定"
                    href="/settings"
                    gradient="from-zinc-500 to-zinc-600"
                    glowColor="#71717a"
                    size="small"
                    delay={6}
                />
            </div>
        </div>
    );
}
