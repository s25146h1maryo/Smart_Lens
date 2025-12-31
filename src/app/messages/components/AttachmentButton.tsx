"use client";

import { useRef, useState, useEffect } from "react";
import { useChatUpload } from "../ChatUploadContext";
import { Paperclip, Smartphone, Cloud } from "lucide-react";

interface AttachmentButtonProps {
    chatId: string;
    groupName: string;
    participants: string[];
    onAttachmentsAdd: (attachments: any[]) => void;
    onDriveClick: () => void;
}

export default function AttachmentButton({ 
    chatId, 
    groupName, 
    participants, 
    onAttachmentsAdd, 
    onDriveClick
}: AttachmentButtonProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { uploadFile } = useChatUpload();

    // Click Outside to Close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Non-blocking upload using the context
    const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsOpen(false);
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Queue each file for upload (non-blocking)
        Array.from(files).forEach(file => {
            uploadFile(
                file,
                {
                    chatId,
                    groupName,
                    participants
                },
                (attachment) => {
                    // Called when each file completes
                    onAttachmentsAdd([attachment]);
                }
            );
        });

        // Clear input immediately so user can continue chatting
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <input 
                type="file" 
                ref={fileInputRef}
                multiple
                className="hidden"
                onChange={handleLocalUpload}
            />

            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-full transition-colors flex items-center justify-center ${
                    isOpen ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
                title="ファイルを添付"
            >
                <Paperclip className="w-5 h-5" />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-3 w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full text-left px-4 py-3 hover:bg-white/10 flex items-center gap-3 text-zinc-200 text-sm transition-colors"
                    >
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <Smartphone className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold">デバイスからアップロード</span>
                            <span className="text-[10px] text-zinc-500">写真やファイルを選択</span>
                        </div>
                    </button>
                    
                    <button 
                        onClick={() => {
                            setIsOpen(false);
                            onDriveClick();
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-white/10 flex items-center gap-3 text-zinc-200 text-sm border-t border-white/5 transition-colors"
                    >
                        <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
                             <Cloud className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold">SmartLens Driveから選択</span>
                            <span className="text-[10px] text-zinc-500">クラウド上のファイルを使用</span>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}
