"use client";

import Link from "next/link";

import { Folder, Hash, Calendar, Settings } from "lucide-react";

const apps = [
    { name: 'Drive', label: 'ドライブ', icon: Folder, bg: 'bg-blue-500', href: '/drive' },
    { name: 'Threads', label: 'スレッド', icon: Hash, bg: 'bg-indigo-500', href: '/threads' },
    { name: 'Calendar', label: 'カレンダー', icon: Calendar, bg: 'bg-emerald-500', href: '/calendar' },
    { name: 'Settings', label: '設定', icon: Settings, bg: 'bg-zinc-600', href: '/settings' },
];

export default function DockMenu() {
    return (
        <div className="flex justify-center mt-8 pb-4">
            <div className="flex items-end gap-3 px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl">
                {apps.map((app) => (
                    <Link 
                        href={app.href} 
                        key={app.name}
                        className="group relative flex flex-col items-center gap-1 transition-all duration-300 hover:-translate-y-2"
                    >
                         <div className={`w-12 h-12 ${app.bg} rounded-xl shadow-lg flex items-center justify-center text-zinc-100 group-hover:shadow-${app.bg.split('-')[1]}-500/50`}>
                             <app.icon className="w-6 h-6" />
                         </div>
                         <div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 text-xs font-medium text-zinc-300 transition-opacity whitespace-nowrap">
                             {app.label}
                         </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
