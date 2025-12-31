import { useState, useEffect, useCallback } from 'react';
import { WeeklyAttendance, AttendanceStatus } from '@/types/attendance';
import { getWeekAttendance, updateAttendanceStatus, cleanupOldAttendance } from '@/app/actions/attendance';
import { format } from 'date-fns';

export function useWeekAttendance(startDate: Date) {
    const [attendance, setAttendance] = useState<WeeklyAttendance>({});
    const [loading, setLoading] = useState(true);

    const startDateStr = format(startDate, 'yyyy-MM-dd');

    // Fetch attendance data
    const fetchAttendance = useCallback(async () => {
        try {
            const data = await getWeekAttendance(startDateStr);
            setAttendance(data);
        } catch (error) {
            console.error("Failed to fetch attendance:", error);
        } finally {
            setLoading(false);
        }
    }, [startDateStr]);

    // Initial fetch and cleanup
    useEffect(() => {
        setLoading(true);
        
        // Cleanup old data on mount
        cleanupOldAttendance().catch(console.error);
        
        // Fetch current data
        fetchAttendance();

        // Poll for updates every 5 seconds (for multi-user visibility)
        const interval = setInterval(fetchAttendance, 5000);

        return () => clearInterval(interval);
    }, [fetchAttendance]);

    // Update function
    const updateAttendance = useCallback(async (
        dateStr: string,
        _userId: string, // Not needed - server uses session
        _userName: string, // Not needed - server uses session
        status: AttendanceStatus
    ) => {
        // Optimistic update for immediate UI feedback
        setAttendance(prev => ({
            ...prev,
            [dateStr]: {
                ...prev[dateStr],
                [_userId]: {
                    status,
                    userName: _userName,
                    updatedAt: Date.now()
                }
            }
        }));

        // Actually save to server
        const result = await updateAttendanceStatus(dateStr, status);
        
        if (!result.success) {
            // Revert on failure
            console.error("Update failed:", result.error);
            await fetchAttendance();
        }
    }, [fetchAttendance]);

    return { attendance, loading, updateAttendance };
}
