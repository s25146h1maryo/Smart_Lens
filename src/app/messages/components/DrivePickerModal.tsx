"use client";

import { useState, useEffect } from "react";
import { getDriveItems, getBreadcrumbs, getSharedDriveItems, getSharedDriveBreadcrumbs, ensureSharedDriveAccess, getSharedDriveRootId } from "@/app/actions/drive";
import { DriveItem } from "@/types/drive";

interface DrivePickerModalProps {
    onClose: () => void;
    onSelect: (selectedFiles: DriveItem[]) => void;
}

type DriveTab = 'private' | 'shared';

export default function DrivePickerModal({ onClose, onSelect }: DrivePickerModalProps) {
    const [activeTab, setActiveTab] = useState<DriveTab>('private');
    const [items, setItems] = useState<DriveItem[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [sharedFolderId, setSharedFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<{id:string, name:string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [allSelectedItems, setAllSelectedItems] = useState<Map<string, DriveItem>>(new Map());

    // Load folder based on active tab
    useEffect(() => {
        if (activeTab === 'private') {
            loadPrivateFolder(currentFolderId);
        } else {
            loadSharedFolder(sharedFolderId);
        }
    }, [currentFolderId, sharedFolderId, activeTab]);

    // Initialize shared drive access when switching to shared tab
    useEffect(() => {
        if (activeTab === 'shared' && sharedFolderId === null) {
            initSharedDrive();
        }
    }, [activeTab]);

    const initSharedDrive = async () => {
        try {
            await ensureSharedDriveAccess();
            // Don't set sharedFolderId here - null means root of shared drive
        } catch (e) {
            console.error("Failed to initialize shared drive access:", e);
        }
    };

    const loadPrivateFolder = async (folderId: string | null) => {
        setLoading(true);
        try {
            const [fetchedItems, fetchedCrumbs] = await Promise.all([
                getDriveItems(folderId),
                getBreadcrumbs(folderId)
            ]);
            setItems(fetchedItems);
            setBreadcrumbs(fetchedCrumbs);
        } catch (e) {
            console.error("Failed to load private drive items", e);
        } finally {
            setLoading(false);
        }
    };

    const loadSharedFolder = async (folderId: string | null) => {
        setLoading(true);
        try {
            const [fetchedItems, fetchedCrumbs] = await Promise.all([
                getSharedDriveItems(folderId),
                getSharedDriveBreadcrumbs(folderId)
            ]);
            setItems(fetchedItems);
            setBreadcrumbs(fetchedCrumbs);
        } catch (e) {
            console.error("Failed to load shared drive items", e);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab: DriveTab) => {
        if (tab === activeTab) return;
        setActiveTab(tab);
        // Reset folder navigation when switching tabs
        if (tab === 'private') {
            setCurrentFolderId(null);
        } else {
            setSharedFolderId(null);
        }
    };

    const handleFolderNavigate = (folderId: string | null) => {
        if (activeTab === 'private') {
            setCurrentFolderId(folderId);
        } else {
            setSharedFolderId(folderId);
        }
    };

    const handleBreadcrumbClick = async (crumb: {id: string, name: string}, idx: number) => {
        if (activeTab === 'private') {
            setCurrentFolderId(crumb.id === 'root' ? null : crumb.id);
        } else {
            // For shared drive, if it's the root breadcrumb (index 0), go to shared root
            if (idx === 0) {
                setSharedFolderId(null);
            } else {
                setSharedFolderId(crumb.id);
            }
        }
    };

    const handleToggleSelect = (item: DriveItem) => {
        if (item.type === 'folder') return;
        
        const newSelectedIds = new Set(selectedIds);
        const newAllItems = new Map(allSelectedItems);
        
        if (newSelectedIds.has(item.id)) {
            newSelectedIds.delete(item.id);
            newAllItems.delete(item.id);
        } else {
            newSelectedIds.add(item.id);
            newAllItems.set(item.id, item);
        }
        
        setSelectedIds(newSelectedIds);
        setAllSelectedItems(newAllItems);
    };

    const handleConfirm = () => {
        const selectedFiles = Array.from(allSelectedItems.values());
        onSelect(selectedFiles);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
                
                {/* Header with Tabs */}
                <div className="p-4 border-b border-white/10">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="font-bold text-zinc-100 flex items-center gap-2">
                            <span>☁️</span> ドライブから選択
                        </h2>
                        <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
                    </div>
                    
                    {/* Tab Buttons */}
                    <div className="flex bg-zinc-800/50 rounded-lg p-1">
                        <button
                            onClick={() => handleTabChange('private')}
                            className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'private' 
                                    ? 'bg-indigo-600 text-white shadow-lg' 
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>📂</span> マイドライブ
                        </button>
                        <button
                            onClick={() => handleTabChange('shared')}
                            className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'shared' 
                                    ? 'bg-indigo-600 text-white shadow-lg' 
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>👥</span> 共有ドライブ
                        </button>
                    </div>
                </div>

                {/* Breadcrumbs */}
                <div className="p-2 px-4 bg-zinc-800/50 border-b border-white/5 flex gap-2 overflow-x-auto whitespace-nowrap text-sm scrollbar-thin scrollbar-thumb-zinc-700">
                    {breadcrumbs.map((crumb, idx) => (
                        <div key={crumb.id} className="flex items-center text-zinc-400">
                            {idx > 0 && <span className="mx-1">/</span>}
                            <button 
                                onClick={() => handleBreadcrumbClick(crumb, idx)}
                                className={`hover:text-indigo-400 ${idx === breadcrumbs.length -1 ? 'text-white font-bold' : ''}`}
                            >
                                {crumb.name}
                            </button>
                        </div>
                    ))}
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center text-zinc-500 py-10">
                            {activeTab === 'shared' ? '共有ドライブは空です' : 'フォルダは空です'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1">
                            {items.map(item => {
                                const isSelected = selectedIds.has(item.id);
                                return (
                                    <div 
                                        key={item.id}
                                        onClick={() => {
                                            if (item.type === 'folder') handleFolderNavigate(item.id);
                                            else handleToggleSelect(item);
                                        }}
                                        className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${
                                            isSelected 
                                            ? 'bg-indigo-900/40 border-indigo-500/50' 
                                            : 'border-transparent hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="mr-3 text-xl">
                                            {item.type === 'folder' ? '📁' : '📄'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-zinc-200 truncate">{item.name}</div>
                                            <div className="text-xs text-zinc-500">
                                                {item.type === 'folder' ? 'フォルダ' : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                                            </div>
                                        </div>
                                        
                                        {item.type === 'file' && (
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                                isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-500'
                                            }`}>
                                                {isSelected && <span className="text-white text-xs">✓</span>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 flex justify-between items-center bg-zinc-900/50">
                    <div className="text-sm text-zinc-400">
                        {selectedIds.size} 件選択中
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm hover:bg-white/10 text-zinc-300"
                        >
                            キャンセル
                        </button>
                        <button 
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                            選択を共有
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
