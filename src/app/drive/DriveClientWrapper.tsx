"use client";

import { useState, useEffect } from "react";
import { DriveItem } from "@/types/drive";
import { FileList, Breadcrumbs, CreateFolderButton } from "./components";
import { useRouter } from "next/navigation";

import Link from "next/link";
import DriveUploadButton from "./DriveUploadButton"; 


interface DriveProps {
    initialItems: DriveItem[];
    breadcrumbs: {id:string, name:string}[];
    folderId: string;
    isShared?: boolean;
}

export default function DriveClientWrapper({ initialItems, breadcrumbs, folderId, isShared }: DriveProps) {
    const router = useRouter();

    const handleNavigate = (id: string) => {
        // Preserve mode when navigating
        const modeParam = isShared ? '&mode=shared' : '';
        if (id) {
            router.push(`/drive?folderId=${id}${modeParam}`);
        } else {
            router.push(`/drive${isShared ? '?mode=shared' : ''}`);
        }
    };

    const refresh = () => {
        router.refresh();
    };

    const handlePreview = (item: DriveItem) => {
       if (item.type === 'file' && item.webViewLink) {
           window.open(item.webViewLink, '_blank');
       } else {
           alert("Preview link not available");
       }
    };

    return (
        <div>
            {/* Mobile Navigation (Switch Mode) */ }
            <div className="md:hidden flex items-center gap-2 mb-4 bg-zinc-900/50 p-1 rounded-xl border border-white/5 ml-12">
                <button 
                    onClick={() => window.location.href = '/drive'}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${!isShared ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500'}`}
                >
                    My Drive
                </button>
                <button 
                    onClick={() => window.location.href = '/drive?mode=shared'}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${isShared ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500'}`}
                >
                    Shared
                </button>
            </div>

            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                <Breadcrumbs crumbs={breadcrumbs} onNavigate={handleNavigate} onRefresh={refresh} />
                <div className="flex items-center gap-2 justify-end">
                    <CreateFolderButton parentId={folderId} onSuccess={refresh} isShared={isShared} />
                    <DriveUploadButton parentId={folderId} onSuccess={refresh} isShared={isShared} />
                </div>
            </div>

            <FileList 
                items={initialItems} 
                currentFolderId={folderId}
                onNavigate={handleNavigate} 
                onRefresh={refresh} 
                onPreview={handlePreview}
            />
        </div>
    );
}
