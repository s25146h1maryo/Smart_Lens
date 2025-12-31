"use server";

import { auth } from "@/auth";
import { uploadToGemini } from "@/lib/gemini";
import { withRetry } from "@/lib/retry";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createFolder, getDriveClient } from "@/lib/drive"; 
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export interface SuggestedTask {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
}

/**
 * Analyzes an image and returns a list of suggested tasks.
 * The image is temporarily stored in Drive (or we can stream it if strict).
 * For now, we assume client passes a Drive File ID or we handle upload here.
 * To keep it simple for the user, we will handle the upload from FormData here.
 */
export async function analyzeImageForTasks(formData: FormData): Promise<SuggestedTask[]> {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    const file = formData.get("image") as File;
    if (!file) throw new Error("No image provided");

    // 1. Convert File to base64 for direct Gemini usage (Low latency, bypass Drive for analysis? No, user wants connection)
    // Actually, user wants "Strict folder structure". 
    // But for "Analysis Source", maybe we don't need to keep it forever?
    // Let's use standard gemini inline data for speed if valid.
    // Next.js Server Actions limit body size (1MB default). Large images might fail.
    // So we MUST use the Drive Strategy or robust upload.
    
    // Let's implement the "Upload to Drive -> Analyze" flow as it's most robust and fulfills "Linked to Drive".
    
    // However, I can't easily upload Stream to Drive inside Server Action without helper.
    // I'll assume for now standard arrayBuffer is fine for moderate images, or use the existing `getUploadSession` pattern on client.
    
    // WAIT: The prompt says "Main dashboard image analysis". User might just drop a file.
    // If I use client-side direct upload (like before), I get a Drive ID.
    // Then I pass Drive ID to this action. Best approach.
    
    throw new Error("Use analyzeDriveImage instead");
}

export async function analyzeDriveImage(driveFileId: string, mimeType: string): Promise<SuggestedTask[]> {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    try {
        // 1. Bridge Drive -> Gemini
        const { fileUri, name } = await uploadToGemini(driveFileId, mimeType);

        // 2. Prompt Gemini
        const result = await withRetry(async () => {
             return model.generateContent([
                {
                    text: "You are a project manager. Analyze this image (whiteboard, document, or screenshot) and extract actionable tasks. \n" +
                          "Return ONLY a valid JSON array of objects with keys: 'title', 'description', 'priority'. \n" +
                          "Example: [{\"title\": \"Buy Milk\", \"description\": \"2 cartons\", \"priority\": \"high\"}]"
                },
                {
                    fileData: {
                        mimeType,
                        fileUri
                    }
                }
            ]);
        });

        // 3. Parse JSON
        const text = result.response.text();
        const cleanedText = text.replace(/```json|```/g, "").trim();
        const tasks = JSON.parse(cleanedText) as SuggestedTask[];

        return tasks;
    } catch (e) {
        console.error("AI Analysis Failed", e);
        return [];
    }
}
