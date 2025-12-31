"use client";

import { DriveItem } from "@/types/drive";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Folder, Image as ImageIcon, FileText, File, Pencil, Trash2, Plus, Move, Download, X, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createFolder, createSharedFolder, renameItem, deleteItem, moveItems, copyItems } from "@/app/actions/drive";
import { useSearchParams } from "next/navigation";

// --- Icons ---
const FolderIcon = () => <Folder className="w-10 h-10 text-indigo-400 drop-shadow-lg" fill="currentColor" fillOpacity={0.2} />;
const FileIcon = ({mime}: {mime?:string}) => {
    if (mime?.includes('image')) return <ImageIcon className="w-10 h-10 text-purple-400" />;
    if (mime?.includes('pdf')) return <FileText className="w-10 h-10 text-red-400" />;
    return <File className="w-10 h-10 text-zinc-400" />;
};

// --- File List Component ---
export function FileList({ items, currentFolderId, onNavigate, onRefresh, onPreview }: { 
    items: DriveItem[], 
    currentFolderId: string,
    onNavigate: (id: string) => void, 
    onRefresh: () => void,
    onPreview?: (item: DriveItem) => void 
}) {
    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset selection on navigation/refresh (items change)
    // Reset selection on navigation/refresh (items change)
    useEffect(() => {
        setSelectedIds(new Set());
        setLastSelectedId(null);
    }, [items]);

    // Keyboard Shortcuts (Copy/Cut/Paste)
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Ignore if input/textarea is active
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c') {
                    // Copy
                    if (selectedIds.size === 0) return;
                    e.preventDefault();
                    localStorage.setItem('smartlens_drive_clipboard', JSON.stringify({
                        op: 'copy',
                        ids: Array.from(selectedIds)
                    }));
                    // Optional: Toast "Copied"
                } else if (e.key === 'x') {
                    // Cut
                    if (selectedIds.size === 0) return;
                    e.preventDefault();
                    localStorage.setItem('smartlens_drive_clipboard', JSON.stringify({
                        op: 'move',
                        ids: Array.from(selectedIds)
                    }));
                    // Optional: Toast "Cut"
                } else if (e.key === 'v') {
                    // Paste
                    e.preventDefault();
                    const clipboard = localStorage.getItem('smartlens_drive_clipboard');
                    if (!clipboard) return;
                    try {
                        const { op, ids } = JSON.parse(clipboard);
                        if (!ids || ids.length === 0) return;
                        
                        // Prevent pasting into self if same folder (logic usually allows it for copy as duplicate)
                        // But for Move, moving to same folder is no-op.
                        
                        if (op === 'copy') {
                            await copyItems(ids, currentFolderId || null);
                        } else if (op === 'move') {
                            await moveItems(ids, currentFolderId || null);
                            // Clear clipboard on move? Usually yes.
                            localStorage.removeItem('smartlens_drive_clipboard');
                        }
                        onRefresh();
                        setSelectedIds(new Set()); // Clear selection after paste?
                    } catch (err) {
                        console.error(err);
                        alert("貼り付けに失敗しました");
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, currentFolderId, onRefresh]);

    // Handlers
    const handleSelect = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        
        const newSelected = new Set(e.ctrlKey || e.metaKey ? selectedIds : []);
        
        if (e.shiftKey && lastSelectedId) {
            const start = items.findIndex(i => i.id === lastSelectedId);
            const end = items.findIndex(i => i.id === id);
            const low = Math.min(start, end);
            const high = Math.max(start, end);
            for (let i = low; i <= high; i++) {
                newSelected.add(items[i].id);
            }
        } else {
            if (e.ctrlKey || e.metaKey) {
                if (newSelected.has(id)) newSelected.delete(id);
                else newSelected.add(id);
            } else {
                newSelected.add(id);
            }
            setLastSelectedId(id);
        }
        setSelectedIds(newSelected);
    };

    const handleClearSelection = () => {
        setSelectedIds(new Set());
        setLastSelectedId(null);
    };

    const handleDoubleClick = (item: DriveItem) => {
        if (item.type === 'folder') {
            onNavigate(item.id);
        } else {
            // Open Viewer
            if (item.webViewLink) {
                window.open(item.webViewLink, '_blank');
            } else {
                alert("プレビューできません");
            }
        }
    };

    // Rename
    const handleRename = async (item: DriveItem) => {
        const newName = prompt("名前を変更:", item.name);
        if (!newName || newName === item.name) return;
        try {
            await renameItem(item.id, newName);
            onRefresh();
        } catch(e) { alert("変更失敗"); }
    };

    // Delete (Single or Multi)
    const handleDelete = async (ids: string[]) => {
        if (!confirm(`${ids.length} 項目を削除しますか？`)) return;
        try {
            await Promise.all(ids.map(id => deleteItem(id)));
            onRefresh();
            setSelectedIds(new Set());
        } catch(e) { alert("削除失敗"); }
    };

    // Move (Drag & Drop)
    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedData = e.dataTransfer.getData("text/plain");
        if (!draggedData) return;

        const { ids } = JSON.parse(draggedData) as { ids: string[] };
        if (ids.includes(targetId)) return; // Cannot drop on self

        try {
            await moveItems(ids, targetId);
            onRefresh();
        } catch (e) {
            console.error(e);
            alert("移動に失敗しました");
        }
    };

    const handleDragStart = (e: React.DragEvent, item: DriveItem) => {
        const ids = selectedIds.has(item.id) ? Array.from(selectedIds) : [item.id];
        e.dataTransfer.setData("text/plain", JSON.stringify({ ids }));
        e.dataTransfer.effectAllowed = "move";
    };

    // Download (Multi)
    const handleDownload = async () => {
        const selectedItems = items.filter(i => selectedIds.has(i.id) && i.type !== 'folder');
        if (selectedItems.length === 0) return;

        // Try to trigger downloads
        // Note: Browsers block multiple popups. UX usually bundles as ZIP, but efficient for now:
        for (const item of selectedItems) {
            if (item.webViewLink) {
                 // Convert view link to download link if possible, or just open
                 // GDrive view links: https://docs.google.com/file/d/ID/view?usp=drivesdk
                 // Download: https://drive.google.com/uc?export=download&id=ID
                 // Simple hack for standard files
                 let url = item.webViewLink;
                 if (url.includes('/view')) {
                     const match = url.match(/\/d\/(.+?)\//);
                     if (match) url = `https://drive.google.com/uc?export=download&id=${match[1]}`;
                 }
                 window.open(url, '_blank');
                 await new Promise(r => setTimeout(r, 500)); // Delay
            }
        }
    };


    if (items.length === 0) {
        return (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-zinc-500 text-center mt-20 flex flex-col items-center gap-4"
            >
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center">
                    <Folder className="w-8 h-8 text-zinc-600" />
                </div>
                <p>フォルダは空です</p>
            </motion.div>
        );
    }

    return (
        <div 
            ref={containerRef} 
            className="min-h-[50vh] pb-24" 
            onClick={handleClearSelection}
        >
            <motion.div 
                layout
                className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4"
            >
                <AnimatePresence>
                    {items.map((item) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                            key={item.id}
                            onClick={(e) => handleSelect(e, item.id)}
                            onDoubleClick={() => handleDoubleClick(item)}
                            draggable
                            onDragStart={(e) => handleDragStart(e as any, item)}
                            onDragOver={(e) => {
                                if (item.type === 'folder') e.preventDefault();
                            }}
                            onDrop={(e) => {
                                if (item.type === 'folder') handleDrop(e as any, item.id);
                            }}
                            className={`
                                group relative aspect-square rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all
                                ${selectedIds.has(item.id) 
                                    ? 'bg-indigo-500/20 border-2 border-indigo-500 shadow-lg shadow-indigo-500/20' 
                                    : 'bg-zinc-900/50 border border-white/5 hover:bg-zinc-800'
                                }
                            `}
                        >
                            {/* Selection Check (Visual) */}
                            {selectedIds.has(item.id) && (
                                <div className="absolute top-2 left-2 text-indigo-400">
                                    <CheckSquare className="w-4 h-4" />
                                </div>
                            )}

                            {/* Icon */}
                            {item.type === 'folder' ? <FolderIcon /> : <FileIcon mime={item.mimeType} />}
                            
                            {/* Name */}
                            <span className="text-sm text-zinc-300 w-full text-center truncate font-medium select-none">
                                {item.name}
                            </span>

                            {/* Quick Actions (Hover) - Only single item context */}
                            {!selectedIds.has(item.id) && (
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRename(item); }} 
                                        className="p-1.5 hover:bg-white/20 rounded-md bg-black/60 text-zinc-300"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>

            {/* Selection Toolbar */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6 z-50 backdrop-blur-md"
                    >
                        <span className="text-sm font-bold text-white whitespace-nowrap">
                            {selectedIds.size} 項目を選択中
                        </span>
                        
                        <div className="h-6 w-px bg-white/10" />

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleDownload}
                                className="p-2 hover:bg-white/10 rounded-full text-zinc-300 hover:text-white transition-colors" 
                                title="ダウンロード"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => handleDelete(Array.from(selectedIds))}
                                className="p-2 hover:bg-red-500/20 rounded-full text-zinc-300 hover:text-red-400 transition-colors"
                                title="削除"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="h-6 w-px bg-white/10" />

                        <button onClick={handleClearSelection} className="text-xs text-zinc-500 hover:text-white">
                           <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Breadcrumbs ---
// --- Breadcrumbs ---
export function Breadcrumbs({ crumbs, onNavigate, onRefresh }: { 
    crumbs: {id:string, name:string}[], 
    onNavigate: (id: string) => void,
    onRefresh: () => void 
}) {
    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedData = e.dataTransfer.getData("text/plain");
        if (!draggedData) return;

        try {
            const { ids } = JSON.parse(draggedData) as { ids: string[] };
            // Move to target
            // If target is root, pass null
            const finalTargetId = targetId === 'root' ? null : targetId;
            
            await moveItems(ids, finalTargetId);
            onRefresh();
        } catch (e) {
            console.error(e);
            alert("移動失敗");
        }
    };

    return (
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6 overflow-x-auto whitespace-nowrap no-scrollbar">
            {crumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center gap-2">
                    <span 
                        onClick={() => onNavigate(crumb.id === 'root' ? '' : crumb.id)}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(e) => handleDrop(e, crumb.id)}
                        className={`cursor-pointer hover:text-white hover:underline transition-colors px-2 py-1 rounded-md hover:bg-white/5 ${idx === crumbs.length - 1 ? 'text-white font-bold bg-white/5' : ''}`}
                    >
                        {crumb.name}
                    </span>
                    {idx < crumbs.length - 1 && <span className="text-zinc-600">/</span>}
                </div>
            ))}
        </div>
    );
}

// --- Create Folder ---
export function CreateFolderButton({ parentId, onSuccess, isShared }: { parentId: string, onSuccess: () => void, isShared?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsCreating(true);
        try {
            if (isShared) {
                await createSharedFolder(name, parentId || null);
            } else {
                await createFolder(name, parentId || null);
            }
            setIsOpen(false);
            setName("");
            onSuccess();
        } catch (e) {
            alert("フォルダ作成失敗");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg hover:shadow-indigo-500/20"
            >
                <Plus className="w-4 h-4" /> 新規フォルダ
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                    >
                        <h3 className="text-lg font-bold text-white mb-4">新しいフォルダ</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="フォルダ名を入力" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <div className="flex justify-end gap-2">
                                <button 
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button 
                                    type="submit"
                                    disabled={!name.trim() || isCreating}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {isCreating ? "作成中..." : "作成"}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </>
    );
}

// --- Layout Wrapper ---
export function DriveLayout({ children }: { children: React.ReactNode }) {
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode');
    const isShared = mode === 'shared';

    return (
        <div className="h-screen w-full bg-[#050510] flex overflow-hidden font-sans">
             {/* Sidebar */}
             <div className="w-64 border-r border-white/5 p-6 hidden md:flex flex-col gap-6 bg-zinc-900/30 backdrop-blur-xl">
                 <div className="flex items-center gap-2 px-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
                        <Folder className="w-5 h-5 text-white" fill="currentColor" />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Drive</h2>
                 </div>

                 <nav className="space-y-1">
                     <p className="text-xs font-bold text-zinc-500 px-3 mb-2 uppercase tracking-wider">Storage</p>
                     <Link 
                        href="/drive" 
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${!isShared ? 'bg-indigo-500/10 text-indigo-300' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                     >
                        <File className={`w-4 h-4 ${!isShared ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                        マイドライブ
                     </Link>
                     <Link 
                        href="/drive?mode=shared" 
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isShared ? 'bg-indigo-500/10 text-indigo-300' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                     >
                        <Folder className={`w-4 h-4 ${isShared ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                        共有ドライブ
                     </Link>
                 </nav>
             </div>
             
             <div className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
                 {children}
             </div>
        </div>
    );
}
