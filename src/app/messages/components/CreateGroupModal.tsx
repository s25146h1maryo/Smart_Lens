"use client";

import { useState } from "react";
import { createGroup } from "@/app/actions/chat";

interface CreateGroupModalProps {
    users: any[];
    onClose: () => void;
    onCreated: () => void;
}

export default function CreateGroupModal({ users, onClose, onCreated }: CreateGroupModalProps) {
    const [groupName, setGroupName] = useState("");
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const toggleUser = (uid: string) => {
        if (selectedUserIds.includes(uid)) {
            setSelectedUserIds(prev => prev.filter(id => id !== uid));
        } else {
            setSelectedUserIds(prev => [...prev, uid]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupName.trim() || selectedUserIds.length === 0) return;

        setIsLoading(true);
        try {
            await createGroup(groupName, selectedUserIds);
            onCreated();
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to create group");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-white mb-4">Create Group Chat</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Group Name</label>
                        <input 
                            type="text"
                            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. Project Alpha Team"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Members</label>
                        <div className="max-h-48 overflow-y-auto space-y-2 border border-white/10 rounded-lg p-2 bg-zinc-800/50">
                            {users.filter(u => 
                                u.nickname !== "Unknown" && 
                                u.name !== "Unknown" &&
                                (u.nickname || u.name) && 
                                (u.nickname || u.name).trim() !== ""
                            ).map(user => (
                                <div 
                                    key={user.id}
                                    onClick={() => toggleUser(user.id)}
                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedUserIds.includes(user.id) ? 'bg-indigo-600/20 border border-indigo-500/50' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedUserIds.includes(user.id) ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-500'}`}>
                                        {selectedUserIds.includes(user.id) && <span className="text-[10px] text-white">✓</span>}
                                    </div>
                                    <span className="text-sm text-zinc-200">{user.nickname || user.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isLoading || !groupName || selectedUserIds.length === 0}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isLoading ? "Creating..." : "Create Group"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
