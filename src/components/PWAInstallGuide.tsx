"use client";

import { useState, useEffect } from "react";
import { X, Share, Plus, Smartphone, Download } from "lucide-react";

export default function PWAInstallGuide() {
    const [showGuide, setShowGuide] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if app is already in standalone mode
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
            || (window.navigator as any).standalone === true;
        setIsStandalone(isInStandaloneMode);

        if (isInStandaloneMode) return; // Don't show guide if in standalone

        // Detect platform
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        const isAndroidDevice = /android/.test(userAgent);
        
        setIsIOS(isIOSDevice);
        setIsAndroid(isAndroidDevice);

        // Check if guide has been dismissed before
        const dismissed = localStorage.getItem('pwa-guide-dismissed');
        if (!dismissed && (isIOSDevice || isAndroidDevice)) {
            // Show guide after a short delay
            setTimeout(() => setShowGuide(true), 2000);
        }
    }, []);

    const handleDismiss = () => {
        setShowGuide(false);
        localStorage.setItem('pwa-guide-dismissed', 'true');
    };

    const handleRemindLater = () => {
        setShowGuide(false);
        // Will show again on next page load
    };

    if (isStandalone || !showGuide) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-zinc-900 border border-white/10 rounded-t-3xl md:rounded-2xl w-full max-w-md mx-4 md:mx-auto overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-center relative">
                    <button 
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X size={16} className="text-white" />
                    </button>
                    <div className="w-16 h-16 rounded-2xl bg-white/20 mx-auto mb-4 flex items-center justify-center">
                        <Smartphone size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">アプリとして追加</h2>
                    <p className="text-white/80 text-sm">ホーム画面からすばやくアクセス</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {isIOS && (
                        <div className="space-y-4">
                            <p className="text-zinc-400 text-sm text-center mb-4">
                                Safariのメニューからホーム画面に追加すると、アプリのようにアドレスバーなしで使えます。
                            </p>
                            <div className="flex items-start gap-4 bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-lg font-bold text-indigo-400">1</span>
                                </div>
                                <div>
                                    <p className="text-white font-medium mb-1">共有ボタンをタップ</p>
                                    <p className="text-zinc-500 text-sm">画面下部の <Share size={14} className="inline text-indigo-400" /> をタップ</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-lg font-bold text-indigo-400">2</span>
                                </div>
                                <div>
                                    <p className="text-white font-medium mb-1">「ホーム画面に追加」を選択</p>
                                    <p className="text-zinc-500 text-sm">メニューをスクロールして <Plus size={14} className="inline text-indigo-400" /> ホーム画面に追加</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-lg font-bold text-indigo-400">3</span>
                                </div>
                                <div>
                                    <p className="text-white font-medium mb-1">「追加」をタップ</p>
                                    <p className="text-zinc-500 text-sm">右上の「追加」をタップして完了</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {isAndroid && (
                        <div className="space-y-4">
                            <p className="text-zinc-400 text-sm text-center mb-4">
                                Chromeのメニューからホーム画面に追加すると、アプリのように使えます。
                            </p>
                            <div className="flex items-start gap-4 bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-lg font-bold text-indigo-400">1</span>
                                </div>
                                <div>
                                    <p className="text-white font-medium mb-1">メニューを開く</p>
                                    <p className="text-zinc-500 text-sm">右上の ⋮ をタップ</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-lg font-bold text-indigo-400">2</span>
                                </div>
                                <div>
                                    <p className="text-white font-medium mb-1">「ホーム画面に追加」を選択</p>
                                    <p className="text-zinc-500 text-sm"><Download size={14} className="inline text-indigo-400" /> ホーム画面に追加 をタップ</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-zinc-800/50 rounded-xl p-4 border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-lg font-bold text-indigo-400">3</span>
                                </div>
                                <div>
                                    <p className="text-white font-medium mb-1">「追加」をタップ</p>
                                    <p className="text-zinc-500 text-sm">確認ダイアログで「追加」をタップ</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-white/5 flex gap-3">
                    <button 
                        onClick={handleRemindLater}
                        className="flex-1 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
                    >
                        あとで
                    </button>
                    <button 
                        onClick={handleDismiss}
                        className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
