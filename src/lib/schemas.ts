import { z } from "zod";

export const UserRoleSchema = z.enum(["ROOT", "TEACHER", "ADMIN", "USER", "PENDING", "REJECTED"]);

export const UserStatusSchema = z.object({
    location: z.string().max(30),
    availability: z.string().max(20),
});

export const UserProfileSchema = z.object({
    uid: z.string(),
    email: z.string().email(),
    role: UserRoleSchema,
    jobTitle: z.string().trim().min(2).max(50),
    status: UserStatusSchema,
    stats: z.object({
        attendanceCount: z.number().int().nonnegative(),
    }),
    createdAt: z.number(),
    updatedAt: z.number(),
});

export const UpdateUserProfileSchema = z.object({
    jobTitle: z.string().trim().max(50).optional().nullable(),
    nickname: z.string().trim().min(1, "Nickname cannot be empty").max(30).optional(),
    status: UserStatusSchema.partial().optional(),
});

export const CreateThreadSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100),
    description: z.string().max(500).optional(),
    members: z.array(z.string()).optional(),
    hiddenFromGlobalTodo: z.boolean().optional(),
});

export const UpdateThreadSchema = z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(["creating", "active", "archived"]).optional(),
    hiddenFromGlobalTodo: z.boolean().optional(),
});

// Task Attachment Schema - validates file attachment data
export const TaskAttachmentSchema = z.object({
    name: z.string().min(1).max(255),
    mimeType: z.string().max(100).optional(),
    size: z.number().int().nonnegative().optional(),
    driveFileId: z.string().max(200).optional(),
    driveId: z.string().max(200).optional(),
    id: z.string().max(200).optional(),
    url: z.string().url().optional(),
    webViewLink: z.string().url().optional(),
}).refine(
    (data) => data.driveFileId || data.driveId || data.id,
    { message: "At least one of driveFileId, driveId, or id must be provided" }
);

