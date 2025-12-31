import { useState, useEffect, useCallback } from 'react';
import { getRoomStatus, updateRoomStatus, RoomStatusData, RoomStatusRecord } from '@/app/actions/room_status';

export function useRoomStatus() {
    const [data, setData] = useState<RoomStatusData>({
        current: null,
        history: [],
        stats: { openCount: 0, totalDays: 30 }
    });
    const [loading, setLoading] = useState(true);

    // Fetch room status data
    const fetchStatus = useCallback(async () => {
        try {
            const result = await getRoomStatus();
            setData(result);
        } catch (error) {
            console.error("Failed to fetch room status:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch and polling
    useEffect(() => {
        setLoading(true);
        fetchStatus();

        // Poll for updates every 5 seconds
        const interval = setInterval(fetchStatus, 5000);

        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Toggle status
    const toggleStatus = useCallback(async (
        userId: string,
        userName: string,
        newIsOpen: boolean
    ) => {
        // Optimistic update
        const optimisticRecord: RoomStatusRecord = {
            isOpen: newIsOpen,
            updatedAt: Date.now(),
            updatedBy: userId,
            updatedByName: userName,
        };

        setData(prev => ({
            ...prev,
            current: optimisticRecord,
            history: [optimisticRecord, ...prev.history.slice(0, 9)],
            // If opening, optimistically update stats
            stats: newIsOpen 
                ? { ...prev.stats, openCount: prev.stats.openCount + 1 }
                : prev.stats
        }));

        // Save to server
        const result = await updateRoomStatus(newIsOpen);
        
        if (!result.success) {
            console.error("Update failed:", result.error);
            await fetchStatus(); // Revert on failure
        }
    }, [fetchStatus]);

    return { 
        current: data.current, 
        history: data.history, 
        stats: data.stats,
        loading, 
        toggleStatus 
    };
}
