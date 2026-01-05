import { useCallback } from 'react';
import { updateRoomStatus } from '@/app/actions/room_status';
import { useRoomStatusListener } from './useRTDB';

export function useRoomStatus() {
    // Rely on Realtime Database listener for data (No CPU-intensive polling)
    const { data, loading } = useRoomStatusListener();

    // Toggle status - Keep Server Action for strict writes, 
    // but the UI update will come from the RTDB listener automatically.
    const toggleStatus = useCallback(async (
        userId: string,
        userName: string,
        newIsOpen: boolean
    ) => {
        // Optimistic update is handled by the Listener (speed is near-instant)
        // or we can optimistically set local state if needed, 
        // but for simplicity & correctness we trust the listener.
        
        // Save to server (which updates RTDB, which triggers listener)
        const result = await updateRoomStatus(newIsOpen);
        
        if (!result.success) {
            console.error("Update failed:", result.error);
            // Error handling could be added here (e.g. toast)
        }
    }, []);

    return { 
        current: data.current, 
        history: data.history, 
        stats: data.stats,
        loading, 
        toggleStatus 
    };
}
