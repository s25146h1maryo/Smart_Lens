"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface UnifiedHeaderProps {
    title: string | ReactNode;
    subtitle?: string | ReactNode;
    user?: {
        name: string;
        email?: string;
        image?: string;
    } | null;
    children?: ReactNode; // Right side actions
    leftChildren?: ReactNode; // Controls next to title
    className?: string;
}

export default function UnifiedHeader({ 
    title, 
    subtitle, 
    user, 
    children, 
    leftChildren, 
    className = "" 
}: UnifiedHeaderProps) {
    const defaultUser = { name: "User", email: "user@example.com", image: "U" };
    const displayUser = user || defaultUser;
    // Extract initial from name if image is not a URL (assuming image prop might be initial char or url)
    // But based on GlassHeader, it uses explicit initial prop.
    // Let's adapt to be flexible. If image is 1 char, treat as initial.
    
    // Actually, looking at GlassHeader, it took nickname, email, initial.
    // Let's standardise on passing a user object or individual props?
    // The plan said "user" object.
    
    const initial = displayUser.image && displayUser.image.length === 1 ? displayUser.image : displayUser.name[0]?.toUpperCase() || "U";

    return (
        <header className={`flex items-center justify-between py-0 mb-0 min-h-[40px] ${className}`}>
            <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2 pl-14 md:pl-0"> {/* pl-14 for hamburger */}
                    {typeof title === 'string' ? (
                        <h1 className="hidden md:block text-lg md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 leading-tight">
                            {title}
                        </h1>
                    ) : (
                        title
                    )}
                    {leftChildren}
                </div>
                
                {subtitle && (
                    <div className="text-zinc-500 text-[10px] md:text-xs leading-none pl-14 md:pl-0">
                        {subtitle}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 md:gap-6">
                {children}

                {/* Profile Pill */}
                {user && (
                    <Link href="/settings" className="flex items-center gap-3 px-2 md:px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group cursor-pointer">
                        <span className="text-sm text-zinc-300 font-medium hidden sm:block">{displayUser.email || displayUser.name}</span>
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20">
                            {initial}
                        </div>
                    </Link>
                )}
            </div>
        </header>
    );
}
