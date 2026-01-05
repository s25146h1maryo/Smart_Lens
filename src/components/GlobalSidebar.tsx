"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export default function GlobalSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const role = session?.user?.role;
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

    // Close sidebar on route change
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    return (
        <>
            {/* Mobile Toggle Button - Fixed Top Left */}
            <button 
                onClick={() => setIsMobileOpen(true)}
                className="md:hidden fixed left-4 z-50 p-2.5 bg-zinc-900/90 backdrop-blur-md rounded-full border border-white/10 text-white shadow-xl active:scale-95 transition-all"
                style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
                aria-label="Menu"
            >
                <Menu size={20} />
            </button>

            {/* Mobile Backdrop */}
            {isMobileOpen && (
                <div 
                    className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <nav className={`
                fixed top-0 bottom-0 left-0 z-50
                flex flex-col items-center py-4 gap-4 
                bg-zinc-950 border-r border-white/5
                transition-transform duration-300 ease-in-out
                w-[72px]
                ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                {/* Mobile Close Button (Optional, but good for UX) */}
                <button 
                    onClick={() => setIsMobileOpen(false)}
                    className="md:hidden mb-2 p-2 text-zinc-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                {/* Home / Dashboard */}
                <SidebarItem href="/dashboard" icon="🏠" active={isActive('/dashboard')} label="Home" />
                
                <div className="w-10 h-[2px] bg-zinc-800 rounded-full" />
                
                {/* Core Features */}
                <SidebarItem href="/threads" icon="📂" active={isActive('/threads') || isActive('/thread')} label="Threads" />
                <SidebarItem href="/messages" icon="💬" active={isActive('/messages')} label="Messages" />
                <SidebarItem href="/drive" icon="📁" active={isActive('/drive')} label="Drive" />
                <SidebarItem href="/calendar" icon="📅" active={isActive('/calendar')} label="Calendar" />

                <div className="w-10 h-[2px] bg-zinc-800 rounded-full" />

                {/* Future / Placeholders */}
                <SidebarItem href="/attendance" icon="📋" active={isActive('/attendance')} label="Attendance" />
                <SidebarItem href="/todo" icon="✅" active={isActive('/todo')} label="Global ToDo" />
                <SidebarItem href="/vote" icon="🗳️" active={isActive('/vote')} label="Voting" />
                <SidebarItem href="/room-status" icon="🚪" active={isActive('/room-status')} label="O/C Status" />
                
                {/* Admin Only */}
                {role && role !== "USER" && (
                    <SidebarItem href="/admin/users" icon="🛡️" active={isActive('/admin/users')} label="Admin Users" />
                )}
                {role === "ROOT" && (
                     <SidebarItem href="/admin/integrity" icon="🔧" active={isActive('/admin/integrity')} label="Integrity" />
                )}

                <div className="mt-auto flex flex-col gap-4">
                     <SidebarItem href="/settings" icon="⚙️" active={isActive('/settings')} label="Settings" />
                </div>
            </nav>
        </>
    );
}

function SidebarItem({ href, icon, active, label }: { href: string; icon: string; active: boolean; label: string }) {
    return (
        <Link 
            href={href}
            className={`
                group relative flex items-center justify-center w-12 h-12 rounded-[24px] 
                transition-all duration-300 ease-in-out
                ${active ? 'bg-indigo-500 rounded-[16px] text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-indigo-500 hover:text-white hover:rounded-[16px]'}
            `}
        >
            <span className="text-xl">{icon}</span>
            
            {/* Indicator Pill */}
            {active && (
                <div className="absolute left-[-18px] w-2 h-10 bg-white rounded-r-lg" />
            )}
            {!active && (
                <div className="absolute left-[-18px] w-2 h-2 bg-white rounded-r-lg opacity-0 group-hover:opacity-100 group-hover:h-5 transition-all duration-300" />
            )}

            {/* Tooltip - Adjusted for mobile touch (hidden on touch usually, but nice if tapping) */}
            <div className={`
                absolute left-14 bg-zinc-900 text-white text-xs font-bold px-3 py-2 rounded-md 
                opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none 
                translate-x-2 whitespace-nowrap z-50 shadow-lg border border-white/10
                hidden md:block 
            `}>
                {label}
            </div>
        </Link>
    );
}

