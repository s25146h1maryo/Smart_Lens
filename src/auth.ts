import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "./lib/firebase";
import { UserProfile, UserRole } from "./types";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly",
                    access_type: "offline",
                    prompt: "consent",
                }
            }
        })
    ],
    callbacks: {
        async signIn({ user }) {
            // Logic centralized in jwt callback to prevent race conditions
            return !!user.email;
        },
        async jwt({ token, user, account, trigger, session }) {
            // 1. Initial Sign In
            if (account && user) {
                token.accessToken = account.access_token;
                token.expiresAt = (account.expires_at || 0) * 1000;
                token.refreshToken = account.refresh_token;

                // --- DE-DUPLICATION & CREATION ---
                if (user.email) {
                     // Check by Email - find ALL users with this email
                     const q = await db.collection("users").where("email", "==", user.email).get();
                     
                     if (!q.empty) {
                         // User(s) Exist -> Use the oldest one, delete duplicates
                         let existingUser = q.docs[0].data() as UserProfile;
                         let existingDoc = q.docs[0];
                         
                         // If multiple docs exist, keep the oldest and delete others
                         if (q.size > 1) {
                             console.log(`[Auth] Found ${q.size} duplicate users for email ${user.email}. Cleaning up...`);
                             
                             // Sort by createdAt to find the oldest
                             const sortedDocs = q.docs.sort((a, b) => {
                                 const aTime = a.data().createdAt || 0;
                                 const bTime = b.data().createdAt || 0;
                                 return aTime - bTime;
                             });
                             
                             // Keep the first (oldest), delete the rest
                             existingDoc = sortedDocs[0];
                             existingUser = existingDoc.data() as UserProfile;
                             
                             for (let i = 1; i < sortedDocs.length; i++) {
                                 const dupId = sortedDocs[i].id;
                                 console.log(`[Auth] Deleting duplicate user: ${dupId}`);
                                 await db.collection("users").doc(dupId).delete();
                             }
                         }
                         
                         token.id = existingUser.uid; 
                         token.role = existingUser.role;
                         token.jobTitle = existingUser.jobTitle;
                         // Use nickname for display, fallback to displayName
                         token.name = existingUser.nickname || existingUser.displayName;

                         // Name Update Check
                         const latestName = user.name || existingUser.displayName;
                         if (latestName && (existingUser.displayName !== latestName || !existingUser.displayName)) {
                             await db.collection("users").doc(existingUser.uid).update({ displayName: latestName });
                         }
                     } else {
                         // New User -> Create
                         const uid = user.id!; // Default NextAuth ID
                         token.id = uid;
                         
                         const newUser: UserProfile = {
                            uid,
                            email: user.email,
                            displayName: user.name || "Unknown",
                            role: user.email === process.env.ROOT_USER_EMAIL ? "ROOT" : "PENDING",
                            jobTitle: "未設定",
                            status: { location: "不明", availability: "不明" },
                            stats: { attendanceCount: 0 },
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                         };
                         await db.collection("users").doc(uid).set(newUser);
                         token.role = newUser.role;
                         token.jobTitle = newUser.jobTitle;
                         token.name = newUser.displayName;
                     }
                 }
            }

            // 2. Client Updates
            if (trigger === "update" && session) {
                token = { ...token, ...session };
            }

            // 3. Firestore Role Sync - CRITICAL SECURITY CHECK
            // Always refresh role from DB using the Stable ID
            if (token.id) {
                 const userDoc = await db.collection("users").doc(token.id as string).get();
                 if (userDoc.exists) {
                     const data = userDoc.data() as UserProfile;
                     token.role = data.role;
                     token.jobTitle = data.jobTitle;
                     // Sync nickname from DB
                     token.name = data.nickname || data.displayName;
                     
                     // Root enforcement (Safety)
                     if (data.email === process.env.ROOT_USER_EMAIL && data.role !== "ROOT") {
                         token.role = "ROOT";
                         await userDoc.ref.update({ role: "ROOT" });
                     }
                 } else {
                     // 🚨 CRITICAL: User was deleted (e.g., during system reset)
                     // Invalidate the session by clearing role
                     console.log(`[Auth] User ${token.id} not found in Firestore - session invalidated`);
                     token.role = null;
                     token.id = null;
                     token.error = "UserDeleted";
                 }
            }

            // 4. Token Rotation
            const shouldRefresh = Date.now() > (token.expiresAt as number);
            if (shouldRefresh && token.refreshToken) {
                return refreshAccessToken(token);
            }

            return token;
        },
        async session({ session, token }) {
            // 🚨 CRITICAL: If user was deleted, invalidate session
            if (token.error === "UserDeleted" || !token.id || !token.role) {
                // Return a minimal session that will fail auth checks
                return {
                    ...session,
                    user: {
                        ...session.user,
                        id: null as any,
                        role: null as any,
                        jobTitle: null as any,
                    },
                    error: "UserDeleted"
                };
            }
            
            session.user.id = token.id as string;
            session.user.role = token.role as UserRole;
            session.user.jobTitle = token.jobTitle as string;
            // Override name with nickname from token
            session.user.name = token.name as string;
            // @ts-ignore
            session.accessToken = token.accessToken as string; 

            return session;
        },
    },
    session: {
        strategy: "jwt",
    }
});

// Helper: Refresh Google Token
async function refreshAccessToken(token: any) {
    try {
        const url = "https://oauth2.googleapis.com/token";
        const response = await fetch(url, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            method: "POST",
            body: new URLSearchParams({
                client_id: process.env.AUTH_GOOGLE_ID!,
                client_secret: process.env.AUTH_GOOGLE_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
            }),
        });

        const refreshedTokens = await response.json();

        if (!response.ok) {
            throw refreshedTokens;
        }

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fallback to old if new not returned
        };
    } catch (error) {
        console.error("RefreshAccessTokenError", error);
        return {
            ...token,
            error: "RefreshAccessTokenError",
        };
    }
}
