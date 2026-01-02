"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsPage() {
    const router = useRouter();

    const handleBack = () => {
        // Use browser history to go back if possible
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push('/');
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-12">
                    <button 
                        onClick={handleBack}
                        className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6"
                    >
                        <ArrowLeft size={16} />
                        戻る
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                            <FileText size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">利用規約</h1>
                            <p className="text-zinc-500">最終更新日: 2026年1月1日</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="prose prose-invert prose-zinc max-w-none space-y-8">
                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">1. サービスの概要</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            SmartLens（以下「本サービス」）は、組織内のタスク管理、コミュニケーション、
                            スケジュール管理を支援するためのプラットフォームです。
                            本サービスは招待制であり、管理者の承認を得たユーザーのみが利用できます。
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">2. 利用条件</h2>
                        <ul className="text-zinc-300 space-y-2 list-disc list-inside">
                            <li>本サービスは組織内部での業務目的にのみ使用してください。</li>
                            <li>アカウントの共有や譲渡は禁止されています。</li>
                            <li>不正アクセスやサービスの妨害行為は禁止されています。</li>
                            <li>他のユーザーを誹謗中傷する行為は禁止されています。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">3. 知的財産権</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            本サービスに関するすべての知的財産権は運営者に帰属します。
                            ユーザーが本サービスに投稿したコンテンツについては、
                            ユーザー自身が権利を保持しますが、サービス提供のために必要な範囲で
                            運営者が使用することに同意したものとみなします。
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">4. 免責事項</h2>
                        <ul className="text-zinc-300 space-y-2 list-disc list-inside">
                            <li>本サービスは「現状有姿」で提供され、特定目的への適合性を保証しません。</li>
                            <li>サービスの中断、データの消失について、運営者は責任を負いません。</li>
                            <li>ユーザー間のトラブルについて、運営者は責任を負いません。</li>
                            <li>本サービスの利用により生じた損害について、運営者は責任を負いません。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">5. サービスの変更・終了</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            運営者は、事前の通知なくサービスの内容を変更、または終了することがあります。
                            サービス終了時には、可能な限り事前にお知らせいたします。
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">6. 規約の変更</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            本利用規約は予告なく変更されることがあります。
                            変更後も本サービスを継続して利用した場合、
                            変更後の利用規約に同意したものとみなします。
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">7. お問い合わせ</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            本利用規約に関するご質問は、管理者までお問い合わせください。
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="mt-16 pt-8 border-t border-white/10 flex items-center justify-between text-sm text-zinc-500">
                    <Link href="/privacy" className="hover:text-white transition-colors">
                        プライバシーポリシー →
                    </Link>
                    <span>© SmartLens</span>
                </div>
            </div>
        </div>
    );
}
