"use server";

import { auth } from "@/auth";
import { db } from "@/lib/firebase";
import { UpdateUserProfileSchema, UserRoleSchema } from "@/lib/schemas";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";

export async function updateProfile(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const rawData = {
        nickname: formData.get("nickname"),
    };

    const validated = UpdateUserProfileSchema.safeParse(rawData);

    if (!validated.success) {
        return { success: false, message: "Invalid input" };
    }

    if (!validated.data.nickname || validated.data.nickname.trim() === "") {
        return { success: false, message: "Nickname cannot be empty" };
    }

    try {
        // Use set with merge to handle both new and existing users
        // update() would fail if document doesn't exist (e.g., after system reset)
        // Note: jobTitle is NOT updated here - admin only
        await db.collection("users").doc(session.user.id).set({
            nickname: validated.data.nickname,
            updatedAt: Date.now(),
        }, { merge: true });

        revalidatePath("/profile");
        revalidatePath("/pending");
        revalidatePath("/admin/users");
        return { success: true, message: "Profile updated successfully" };
    } catch (e) {
        console.error("Update Profile Error", e);
        return { success: false, message: "Failed to update profile" };
    }
}

import { redirect } from "next/navigation";

export async function updateProfileWithRedirect(formData: FormData) {
     const session = await auth();
     const result = await updateProfile(formData);
     
     if (result.success) {
         // PENDING users must stay on /pending, not redirect to dashboard
         if (session?.user?.role === "PENDING") {
             revalidatePath("/pending");
             redirect("/pending");
         } else {
             redirect("/dashboard");
         }
     } else {
         // Don't throw - just redirect back with error state preserved
         // The page will show current state, user can try again
         revalidatePath("/pending");
         redirect("/pending?error=save_failed");
     }
}

// ... approveUser (unchanged) ...

export async function approveUser(userId: string, newRole: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Allow ROOT, ADMIN, and TEACHER to approve users
    const adminDoc = await db.collection("users").doc(session.user.id).get();
    const adminData = adminDoc.data();
    const executorRole = adminData?.role;

    if (executorRole !== "ROOT" && executorRole !== "ADMIN" && executorRole !== "TEACHER") {
        throw new Error("Forbidden: Only ROOT, ADMIN, or TEACHER can approve users.");
    }

    // 1. Fetch Target User
    const targetUserRef = db.collection("users").doc(userId);
    const targetUserDoc = await targetUserRef.get();
    
    if (!targetUserDoc.exists) {
        throw new Error("User not found");
    }

    const targetUserData = targetUserDoc.data();

    // 2. CHECK NICKNAME
    // Enforce that nickname is set and not empty.
    if (!targetUserData?.nickname || targetUserData.nickname.trim() === "") {
        throw new Error("Cannot approve: User has no nickname set. The user must set a nickname first.");
    }

    const role = UserRoleSchema.parse(newRole);

    await targetUserRef.update({
        role: role,
        updatedAt: Date.now()
    });

    revalidatePath("/admin/users");
}

// Cached Data Fetcher - Returns users WITHOUT email for regular use
// SECURITY: Email is intentionally excluded to prevent leakage through cache
export const getCachedUsers = unstable_cache(
    async () => {
        const snap = await db.collection("users").get();
        return snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data.nickname || data.displayName || "Unknown",
                nickname: data.nickname || data.displayName,
                // SECURITY: email removed from default cache
                image: data.image,
                jobTitle: data.jobTitle,
                role: data.role
            };
        });
    },
    ['all_users'],
    { tags: ['users'], revalidate: 60 }
);

// Cached Data Fetcher WITH email - ADMIN ONLY
// Use this only in admin/management contexts
export const getCachedUsersWithEmail = unstable_cache(
    async () => {
        const snap = await db.collection("users").get();
        return snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data.nickname || data.displayName || "Unknown",
                nickname: data.nickname || data.displayName,
                email: data.email,  // Included for admin use
                image: data.image,
                jobTitle: data.jobTitle,
                role: data.role,
                allowGlobalTodo: data.allowGlobalTodo !== false // Default true
            };
        });
    },
    ['all_users_admin'],
    { tags: ['users'], revalidate: 60 }
);

export async function getAllUsers() {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");
    return getCachedUsers();
}

// Admin-only function that includes email
export async function getAllUsersWithEmail() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    
    // Check admin role
    const userRole = session.user.role;
    if (userRole !== "ROOT" && userRole !== "ADMIN" && userRole !== "TEACHER") {
        throw new Error("Admin access required");
    }
    
    return getCachedUsersWithEmail();
}

/**
 * Get only ACTIVE users (USER, ADMIN, TEACHER, ROOT)
 * Excludes PENDING and REJECTED users
 * Use this for thread creation, attendance, messages, etc.
 */
export async function getActiveUsers() {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");
    
    const allUsers = await getCachedUsers();
    return allUsers.filter(u => 
        u.role && 
        u.role !== "PENDING" && 
        u.role !== "REJECTED" &&
        u.nickname && 
        u.nickname.trim() !== "" &&
        u.nickname !== "Unknown"
    );
}

export async function deleteUser(userId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const executorDoc = await db.collection("users").doc(session.user.id).get();
    const executorRole = executorDoc.data()?.role;

    if (executorRole !== "ROOT" && executorRole !== "ADMIN") {
        return { success: false, message: "Forbidden" };
    }

    const targetDoc = await db.collection("users").doc(userId).get();
    if (!targetDoc.exists) return { success: false, message: "User not found" };
    const targetData = targetDoc.data();

    if (targetData?.role === "ROOT") {
        return { success: false, message: "Cannot delete ROOT user" };
    }

    try {
        // Hard delete from Firestore? Or Soft?
        // Let's do hard delete for "Force Delete" context, but maybe keep reference in a "deleted_users" col?
        // For simplicity: Hard delete from 'users' collection. 
        // Auth deletion is separate (Firebase Auth), but we can't do that easily without Admin SDK on server properly initialized with credential for auth management.
        // Assuming we just remove from DB so they can't login/act.
        await db.collection("users").doc(userId).delete();
        revalidatePath("/admin/users");
        return { success: true };
    } catch (e) {
        console.error("Delete User Failed", e);
        return { success: false, message: "Failed to delete user" };
    }
}

export async function updateUserRole(userId: string, newRole: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const executorDoc = await db.collection("users").doc(session.user.id).get();
    const executorRole = executorDoc.data()?.role;

    // Allow ROOT, ADMIN, TEACHER to change roles
    if (executorRole !== "ROOT" && executorRole !== "ADMIN" && executorRole !== "TEACHER") {
        return { success: false, message: "Forbidden" };
    }

    const targetDoc = await db.collection("users").doc(userId).get();
    if (!targetDoc.exists) return { success: false, message: "User not found" };
    const targetData = targetDoc.data();

    if (targetData?.role === "ROOT") {
        return { success: false, message: "Cannot change role of ROOT user" };
    }

    // Only ROOT can promote TO TEACHER
    if (newRole === "TEACHER" && executorRole !== "ROOT") {
         return { success: false, message: "Only ROOT can assign TEACHER role" };
    }

    // Only ROOT can demote FROM TEACHER
    if (targetData?.role === "TEACHER" && executorRole !== "ROOT") {
         return { success: false, message: "Only ROOT can demote TEACHER role" };
    }
    
    // Valid roles check
    if (!["USER", "ADMIN", "PENDING", "TEACHER", "REJECTED"].includes(newRole)) {
         return { success: false, message: "Invalid role" };
    }

    try {
        await db.collection("users").doc(userId).update({
            role: newRole,
            updatedAt: Date.now()
        });
        revalidatePath("/admin/users");
        return { success: true };
    } catch (e) {
        console.error("Update Role Failed", e);
        return { success: false, message: "Failed to update role" };
    }
}

/**
 * Reject a pending user - sets their role to REJECTED instead of deleting
 * This prevents the user from being recreated on next login
 */
export async function rejectUser(userId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const executorDoc = await db.collection("users").doc(session.user.id).get();
    const executorRole = executorDoc.data()?.role;

    if (executorRole !== "ROOT" && executorRole !== "ADMIN" && executorRole !== "TEACHER") {
        return { success: false, message: "Forbidden" };
    }

    const targetDoc = await db.collection("users").doc(userId).get();
    if (!targetDoc.exists) return { success: false, message: "User not found" };
    const targetData = targetDoc.data();

    if (targetData?.role !== "PENDING") {
        return { success: false, message: "Can only reject PENDING users" };
    }

    try {
        await db.collection("users").doc(userId).update({
            role: "REJECTED",
            rejectedAt: Date.now(),
            updatedAt: Date.now()
        });
        revalidatePath("/admin/users");
        return { success: true };
    } catch (e) {
        console.error("Reject User Failed", e);
        return { success: false, message: "Failed to reject user" };
    }
}

/**
 * Update a user's job title - ADMIN ONLY
 * Only ROOT, ADMIN, or TEACHER can update job titles
 */
export async function updateUserJobTitle(userId: string, newJobTitle: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const executorDoc = await db.collection("users").doc(session.user.id).get();
    const executorRole = executorDoc.data()?.role;

    // Only ROOT, ADMIN, TEACHER can update job titles
    if (executorRole !== "ROOT" && executorRole !== "ADMIN" && executorRole !== "TEACHER") {
        return { success: false, message: "Forbidden" };
    }

    const targetDoc = await db.collection("users").doc(userId).get();
    if (!targetDoc.exists) return { success: false, message: "User not found" };

    try {
        await db.collection("users").doc(userId).update({
            jobTitle: newJobTitle.trim() || "未設定",
            updatedAt: Date.now()
        });
        revalidatePath("/admin/users");
        revalidatePath("/settings");
        return { success: true };
    } catch (e) {
        console.error("Update JobTitle Failed", e);
        return { success: false, message: "Failed to update job title" };
    }
}

export async function updateUserGlobalTodoAccess(userId: string, allow: boolean) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const executorDoc = await db.collection("users").doc(session.user.id).get();
    const executorRole = executorDoc.data()?.role;

    if (executorRole !== "ROOT" && executorRole !== "ADMIN") {
        return { success: false, message: "Forbidden" };
    }

    try {
        await db.collection("users").doc(userId).set({
            allowGlobalTodo: allow,
            updatedAt: Date.now()
        }, { merge: true });
        
        revalidatePath("/admin/users");
        revalidatePath("/todo");
        return { success: true };
    } catch (e) {
        console.error("Update Global Todo Access Failed", e);
        return { success: false, message: "Failed to update access" };
    }
}

export async function getUserGlobalTodoAccess(userId: string) {
    try {
        const doc = await db.collection("users").doc(userId).get();
        if (!doc.exists) return false;
        // Default to TRUE if undefined
        return doc.data()?.allowGlobalTodo !== false;
    } catch (e) {
        console.error("Get Access Failed", e);
        return false;
    }
}
