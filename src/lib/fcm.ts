"use client";

import { useEffect, useState } from "react";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app } from "@/lib/firebase-client";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function usePushNotifications(userId?: string) {
    const [permission, setPermission] = useState<NotificationPermission | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async () => {
        if (!userId || !VAPID_KEY) return null;

        setIsLoading(true);
        try {
            const supported = await isSupported();
            if (!supported) {
                console.log("FCM not supported in this browser");
                return null;
            }

            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm === 'granted') {
                // Register service worker first
                const registration = await navigator.serviceWorker.register('/sw.js');
                
                const messaging = getMessaging(app);
                const fcmToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (fcmToken) {
                    setToken(fcmToken);
                    // Save token to user document
                    await saveTokenToServer(userId, fcmToken);
                    return fcmToken;
                }
            }
            return null;
        } catch (error) {
            console.error("Push notification setup error:", error);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // Listen for foreground messages
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let unsubscribe: (() => void) | undefined;

        const setupListener = async () => {
            const supported = await isSupported();
            if (!supported) return;

            const messaging = getMessaging(app);
            unsubscribe = onMessage(messaging, (payload) => {
                console.log("Foreground message received:", payload);
                
                // Show notification even when app is in foreground
                if (payload.notification) {
                    new Notification(payload.notification.title || 'SmartLens', {
                        body: payload.notification.body,
                        icon: '/icons/icon-192.png'
                    });
                }
            });
        };

        setupListener();
        return () => unsubscribe?.();
    }, []);

    return {
        permission,
        token,
        isLoading,
        requestPermission,
        isSupported: typeof window !== 'undefined' && 'Notification' in window
    };
}

async function saveTokenToServer(userId: string, token: string) {
    try {
        const response = await fetch('/api/push/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, token })
        });
        return response.ok;
    } catch (error) {
        console.error("Failed to save FCM token:", error);
        return false;
    }
}
