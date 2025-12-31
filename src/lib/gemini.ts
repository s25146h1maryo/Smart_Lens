import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";
import os from "os";
import { pipeline } from "stream/promises";
import { getDriveClient } from "./drive";
import { withRetry } from "./retry";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Or 2.5-flash if available/released

/**
 * Downloads a file from Drive, saves to /tmp, uploads to Gemini, 
 * waits for processing, and then deletes the local temp file.
 */
export async function uploadToGemini(driveFileId: string, mimeType: string) {
    const tempFilePath = path.join(os.tmpdir(), `gemini_${driveFileId}_${Date.now()}`);
    const drive = getDriveClient();

    try {
        // 1. Download stream from Drive
        const dest = fs.createWriteStream(tempFilePath);

        const driveRes = await drive.files.get(
            { fileId: driveFileId, alt: "media" },
            { responseType: "stream" }
        );

        await pipeline(driveRes.data, dest);

        // 2. Upload to Gemini
        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
            mimeType,
            displayName: `DriveFile_${driveFileId}`,
        });

        const fileUri = uploadResponse.file.uri;
        const name = uploadResponse.file.name;

        // 3. Wait for processing (important for audio/video)
        let file = await fileManager.getFile(name);
        while (file.state === FileState.PROCESSING) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            file = await fileManager.getFile(name);
        }

        if (file.state === FileState.FAILED) {
            throw new Error("Gemini file processing failed.");
        }

        return { fileUri, name };

    } finally {
        // 4. Cleanup /tmp
        if (fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (e) {
                console.error("Failed to cleanup temp file", e);
            }
        }
    }
}

/**
 * Generate minutes from an audio file uploaded to Gemini.
 */
export async function generateMinuteFromGeminiFile(fileUri: string) {
    const result = await withRetry(async () => {
        return model.generateContent([
            {
                text: "You are a professional secretary. Listen to this meeting audio and generate structured minutes. " +
                    "Include: \n1. Date and Attendees (infer if possible)\n2. Agenda Items\n3. Key Discussions\n4. Decisions Made\n5. Action Items (Who, What, When)."
            },
            {
                fileData: {
                    mimeType: "audio/mp3", // Adjust generic mime if needed, or pass specifically
                    fileUri: fileUri
                }
            }
        ])
    });

    return result.response.text();
}
