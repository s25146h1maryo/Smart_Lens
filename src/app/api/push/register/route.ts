import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { userId, token } = await request.json();

        // Verify the user is registering their own token
        if (userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Save token to user document
        await db.collection("users").doc(userId).set({
            fcmToken: token,
            fcmUpdatedAt: Date.now()
        }, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("FCM token registration error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
