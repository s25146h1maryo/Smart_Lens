"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, Check, Loader2 } from "lucide-react";
import { updateProfile } from "@/app/actions/user";
import { usePushNotifications } from "@/lib/fcm";

type NotificationSettings = {
    taskAssignment: boolean;
    newMessage: boolean;
    morningSummary: boolean;
    afternoonAttendance: boolean;
};

const LABEL_MAP: Record<keyof NotificationSettings, string> = {
    taskAssignment: "タスクの割り当て",
    newMessage: "新着メッセージ",
    morningSummary: "朝のサマリー (7:30)",
    afternoonAttendance: "午後の出席状況 (15:45)",
};

const DESC_MAP: Record<keyof NotificationSettings, string> = {
    taskAssignment: "自分が担当者として追加された時に通知します",
    newMessage: "参加しているスレッドやグループの新着メッセージを通知します",
    morningSummary: "今日が締め切りのタスクと担当タスクのまとめを通知します",
    afternoonAttendance: "今日のチームの出席状況まとめを通知します",
};

export default function NotificationSettings({ initialSettings }: { initialSettings?: Partial<NotificationSettings> }) {
    const { data: session } = useSession();
    const { requestPermission, permission } = usePushNotifications(session?.user?.id);
    
    // Default to true
    const [settings, setSettings] = useState<NotificationSettings>({
        taskAssignment: initialSettings?.taskAssignment ?? true,
        newMessage: initialSettings?.newMessage ?? true,
        morningSummary: initialSettings?.morningSummary ?? true,
        afternoonAttendance: initialSettings?.afternoonAttendance ?? true,
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleToggle = async (key: keyof NotificationSettings) => {
        const newValue = !settings[key];
        const newSettings = { ...settings, [key]: newValue };
        setSettings(newSettings);

        setIsSaving(true);
        try {
            // Convert to simple object for Server Action
            // Assuming updateProfile can handle nested JSON or we need a specific action?
            // The existing updateProfile takes FormData. Let's adapt it or call a new action.
            // Since updateProfile takes FormData, let's just make a dedicated lightweight action or pack it.
            // Packing into JSON string for FormData strictly compliant with existing action if possible, 
            // OR finding if we can update flexible fields.
            // Looking at `actions/user.ts`, it processes formData using schema.
            // Let's pack it into `notificationSettings` as JSON string if the schema allows, 
            // Or better, let's create a specialized action here or use the generic one properly.
            // Re-checking schemas: `notificationSettings` is in `UpdateUserProfileSchema`.
            // But `actions/user.ts` usually parses standard fields. 
            // Let's assume we can send it as a JSON string key if the server parses it, 
            // BUT standard FormData only does strings. 
            // Let's try to append each key roughly or just create a specific server action for settings.
            
            // To be safe and clean, I will use a direct server action here if possible, 
            // but I cannot define it IN this file ("use client").
            // I will use `updateProfile` with a little hack or strict formdata.
            // Actually, let's just use the `updateProfile` and send `notificationSettings` as a JSON string
            // and ensure the server action parses it. 
            // *Wait*, I should probably check `user.ts`.
            // For now, I will optimistically assume I can send it via a new dedicated action 
            // that I will add to `user.ts` (or `settings.ts`) later.
            // Actually, I'll just use a direct API call or update `user.ts` next.
            // Let's stick to the plan: I will modify `user.ts` to accept `notificationSettings`.
            
            const formData = new FormData();
            formData.append("notificationSettings", JSON.stringify(newSettings));
            
            // Need to ensure updateProfile handles this.
            await updateProfile(formData); 
            
        } catch (e) {
            console.error(e);
            // Revert on error
            setSettings({ ...settings, [key]: !newValue });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnablePush = async () => {
        const token = await requestPermission();
        if (token) {
            alert("プッシュ通知を有効にしました！");
        } else {
            alert("通知の許可が得られませんでした。ブラウザの設定を確認してください。");
        }
    };

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Bell className="text-indigo-400" size={24} />
                    通知設定
                </h2>
                {permission !== 'granted' && (
                    <button 
                        onClick={handleEnablePush}
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-full transition-colors"
                    >
                        プッシュ通知を有効にする
                    </button>
                )}
            </div>

            <div className="grid gap-3">
                {(Object.keys(settings) as Array<keyof NotificationSettings>).map((key) => (
                    <div 
                        key={key} 
                        className="flex items-center justify-between bg-zinc-950/50 border border-white/5 p-4 rounded-xl"
                    >
                        <div>
                            <div className="text-white font-medium">{LABEL_MAP[key]}</div>
                            <div className="text-xs text-zinc-500">{DESC_MAP[key]}</div>
                        </div>
                        
                        <button
                            onClick={() => handleToggle(key)}
                            disabled={isSaving}
                            className={`
                                relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                                ${settings[key] ? 'bg-indigo-600' : 'bg-zinc-700'}
                                ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            <span className="sr-only">Enable {LABEL_MAP[key]}</span>
                            <span
                                className={`
                                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                    ${settings[key] ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            />
                        </button>
                    </div>
                ))}
            </div>
            
            {isSaving && (
                <div className="flex items-center justify-end text-xs text-zinc-500 gap-2">
                    <Loader2 className="animate-spin" size={12} />
                    Saving...
                </div>
            )}
        </section>
    );
}
