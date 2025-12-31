"use client";

import { useRef } from "react";
import { useUpload } from "./UploadContext";

export default function DriveUploadButton({ parentId, onSuccess, isShared }: { parentId: string, onSuccess: (file?: any) => void, isShared?: boolean }) {
    const { uploadFiles } = useUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        uploadFiles(files, parentId, onSuccess, isShared);
        
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
                + New File
            </button>
            <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
            />
        </>
    );
}
