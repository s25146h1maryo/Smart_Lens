"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export const dynamic = "force-static";

export default function PrivacyPage() {
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
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <Shield size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">プライバシーポリシー</h1>
                            <p className="text-zinc-500">最終更新日: 2026年1月1日</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="prose prose-invert prose-zinc max-w-none space-y-8">
                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">1. 収集する情報</h2>
                        <p className="text-zinc-300 leading-relaxed">本サービスでは、以下の情報を収集します：</p>
                        <ul className="text-zinc-300 space-y-2 list-disc list-inside">
                            <li><strong>アカウント情報:</strong> 名前、メールアドレス、プロフィール画像（Googleアカウント連携時のみ）</li>
                            <li><strong>利用情報:</strong> タスク、メッセージ、ファイル、スケジュールなどのユーザーが入力したデータ</li>
                            <li><strong>技術情報:</strong> ブラウザ情報、アクセスログ（サービス改善目的）</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">2. 情報の利用目的</h2>
                        <ul className="text-zinc-300 space-y-2 list-disc list-inside">
                            <li>本サービスの提供および運営</li>
                            <li>ユーザーサポートの提供</li>
                            <li>サービスの改善および新機能の開発</li>
                            <li>セキュリティの確保および不正利用の防止</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">3. 情報の共有</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            収集した情報は、以下の場合を除き第三者と共有しません：
                        </p>
                        <ul className="text-zinc-300 space-y-2 list-disc list-inside">
                            <li>ユーザーの同意がある場合</li>
                            <li>法令に基づく開示要求がある場合</li>
                            <li>サービス提供に必要なインフラ事業者（Firebase/Google Cloud/運営者のプライベートデータベース）との共有</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">4. データの保存</h2>
                        <ul className="text-zinc-300 space-y-2 list-disc list-inside">
                            <li>データはGoogle Cloud Platform（Firebase）(機密性が高いもの)/運営者のプライベートデータベース(機密性が低いもの)に保存されます。</li>
                            <li>全ファイルはGoogle Drive上に保存されます。</li>
                            <li>アカウント削除時、関連データは即時削除されます。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">5. セキュリティ</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            お客様の情報を保護するため、業界標準のセキュリティ対策を講じています。
                            ただし、インターネット上での完全なセキュリティを保証することはできません。
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">6. ユーザーの権利</h2>
                        <ul className="text-zinc-300 space-y-2 list-disc list-inside">
                            <li>ご自身のデータへのアクセスおよび訂正を求める権利</li>
                            <li>アカウントの削除を求める権利</li>
                            <li>データの利用に関する同意を撤回する権利</li>
                        </ul>
                        <p className="text-zinc-300 leading-relaxed mt-2">
                            これらの権利を行使する場合は、管理者にお問い合わせください。
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">7. Cookie</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            本サービスでは、認証およびセッション管理のためにCookieを使用します。
                            Cookieを無効にした場合、サービスが正常に動作しない可能性があります。
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">8. ポリシーの変更</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            本ポリシーは予告なく変更されることがあります。
                            重要な変更がある場合は、サービス内でお知らせいたします。
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">9. お問い合わせ</h2>
                        <p className="text-zinc-300 leading-relaxed">
                            プライバシーに関するご質問は、管理者までお問い合わせください。
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="mt-16 pt-8 border-t border-white/10 flex items-center justify-between text-sm text-zinc-500">
                    <Link href="/terms" className="hover:text-white transition-colors">
                        ← 利用規約
                    </Link>
                    <span>© SmartLens</span>
                </div>
            </div>
        </div>
    );
}
