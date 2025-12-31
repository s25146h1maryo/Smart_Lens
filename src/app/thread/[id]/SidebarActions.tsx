"use client";

import { useState } from "react";
import CreateTaskModal from "./CreateTaskModal";
import TaskGenerator from "./TaskGenerator"; // existing component, we might wrap it
import styles from "./thread.module.css";

export default function SidebarActions({ threadId }: { threadId: string }) {
    const [mode, setMode] = useState<'none' | 'manual' | 'ai'>('none');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <button 
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setMode('manual')}
            >
                ＋ タスク手動作成
            </button>

            <button 
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                onClick={() => setMode('ai')}
            >
                🚀 AI自動生成
            </button>

            {mode === 'manual' && (
                <CreateTaskModal threadId={threadId} onClose={() => setMode('none')} />
            )}

            {mode === 'ai' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 className={styles.sectionTitle}>AIタスク生成</h3>
                            <button onClick={() => setMode('none')} className="btn-xs">閉じる</button>
                        </div>
                        {/* Reuse existing Generator logic but in modal context */}
                        <TaskGenerator threadId={threadId} />
                    </div>
                </div>
            )}
        </div>
    );
}
