"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import GlobalSidebar from "@/components/GlobalSidebar";
import ThreeBackground from "@/components/ThreeBackground";
import PWAInstallGuide from "@/components/PWAInstallGuide";
import { SessionProvider } from "next-auth/react";
import { UploadProvider } from "@/app/drive/UploadContext";
import { ChatUploadProvider } from "@/app/messages/ChatUploadContext";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    
    // Pages where Sidebar should be HIDDEN (full-screen experience)
    const isFullScreenPage = pathname === "/" || pathname === "/login" || pathname === "/pending" || pathname === "/rejected" || pathname === "/terms" || pathname === "/privacy";

    // Register Service Worker for offline control
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('SW registered:', registration.scope);
                })
                .catch((error) => {
                    console.log('SW registration failed:', error);
                });
        }
    }, []);

    return (
        <SessionProvider>
            <UploadProvider>
                <ChatUploadProvider>
                    {isFullScreenPage ? (
                        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
                            <ThreeBackground>
                                {children}
                            </ThreeBackground>
                        </div>
                    ) : (
                        <div className="flex min-h-screen">
                            <GlobalSidebar />
                            <div className="flex-1 pl-0 md:pl-[72px]">
                                {children}
                            </div>
                        </div>
                    )}
                    {/* PWA Installation Guide (shows on first visit for mobile) */}
                    <PWAInstallGuide />
                </ChatUploadProvider>
            </UploadProvider>
        </SessionProvider>
    );
}

