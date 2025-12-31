"use client";

import Link from "next/link";

interface HeaderProps {
    nickname?: string;
    email?: string;
    initial?: string;
}

export default function GlassHeader({ nickname = "User", email = "User", initial = "U" }: HeaderProps) {
    return (
        <header className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                    Dashboard
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                    Welcome back, <span className="text-indigo-400 font-medium">{nickname}</span>
                </p>
            </div>

            <div className="flex items-center gap-6">

                {/* Profile Pill */}
                <Link href="/settings" className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group cursor-pointer">
                    <span className="text-sm text-zinc-300 font-medium hidden sm:block">{email}</span>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20">
                        {initial}
                    </div>
                </Link>
            </div>
        </header>
    );
}
