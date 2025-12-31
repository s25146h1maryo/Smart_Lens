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
            <div className="flex justify-between items-center mb-6">
                <Breadcrumbs crumbs={breadcrumbs} onNavigate={handleNavigate} onRefresh={refresh} />
                <div className="flex items-center gap-3">
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
