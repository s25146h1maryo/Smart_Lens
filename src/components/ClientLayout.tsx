"use client";

import { usePathname } from "next/navigation";
import GlobalSidebar from "@/components/GlobalSidebar";
import ThreeBackground from "@/components/ThreeBackground";
import { SessionProvider } from "next-auth/react";
import { UploadProvider } from "@/app/drive/UploadContext";
import { ChatUploadProvider } from "@/app/messages/ChatUploadContext";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    
    // Pages where Sidebar should be HIDDEN
    const isFullScreenPage = pathname === "/" || pathname === "/login" || pathname === "/pending" || pathname === "/rejected";

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
                            <div className="flex-1 pl-[72px]">
                                {children}
                            </div>
                        </div>
                    )}
                </ChatUploadProvider>
            </UploadProvider>
        </SessionProvider>
    );
}
