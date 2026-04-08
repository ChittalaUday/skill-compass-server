// @ts-ignore
import { YoutubeTranscript } from "youtube-transcript/dist/youtube-transcript.esm.js";
import { ModuleTranscript, LearningModule } from "../models/index.js";
import { getChatCompletion } from "./groq.js";

interface TranscriptResponse {
    text: string;
    duration: number;
    offset: number;
}

export class TranscriptService {
    /**
     * Fetch transcript for a YouTube video URL
     */
    async fetchTranscriptByUrl(videoUrl: string): Promise<string | null> {
        try {
            const videoId = this.extractVideoId(videoUrl);
            if (!videoId) return null;

            const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
            if (!transcriptItems || transcriptItems.length === 0) return null;

            const jointTranscript = transcriptItems.map((item: TranscriptResponse) => item.text).join(" ");

            // Ensure the transcript is in English
            return await this.translateToEnglish(jointTranscript);
        } catch (error) {
            console.error(`Error fetching transcript for URL ${videoUrl}:`, error);
            return null;
        }
    }

    /**
     * Translates text to English if it's in another language using Groq AI.
     * Processes in chunks for long transcripts.
     */
    async translateToEnglish(text: string): Promise<string> {
        // If text is very short, just return
        if (!text || text.length < 50) return text;

        try {
            // FAST CHECK: Compare ASCII ratio. If > 95% is standard English/ASCII, assume it's English.
            // eslint-disable-next-line no-control-regex
            const nonAsciiCount = (text.match(/[^\x00-\x7F]/g) || []).length;
            const isLikelyEnglish = nonAsciiCount / text.length < 0.05;

            if (isLikelyEnglish) {
                console.log("[Translation] Text is already in English. Skipping AI translation.");
                return text;
            }

            console.log(
                `[Translation] Non-English content detected (${((nonAsciiCount / text.length) * 100).toFixed(1)}%). Translating...`
            );

            // Use chunking for translation to avoid cutting off long transcripts
            const chunkSize = 5000;
            const chunks = this.chunkText(text, chunkSize).slice(0, 15); // Max 75k chars
            const translatedChunks: string[] = [];

            for (let i = 0; i < chunks.length; i++) {
                const prompt = `Translate the following text into clear, educational English. If the text is already in English, return it EXACTLY as it is. 
                Keep the educational terminology intact. Output ONLY the translation.
                
                TEXT TO TRANSLATE (Part ${i + 1}/${chunks.length}):
                ${chunks[i]}
                
                ENGLISH TRANSLATION:`;

                const translation = await getChatCompletion(prompt, {
                    temperature: 0, // Literal translation
                    max_tokens: 2000,
                    systemPrompt:
                        "You are a professional universal translator. You convert any language (Hindi, Chinese, etc.) into perfect English. You respond ONLY with the translated text."
                });

                translatedChunks.push(translation || chunks[i]);
            }

            return translatedChunks.join(" ");
        } catch (_error) {
            console.error("Translation failed for non-English content.");
            return ""; // Return empty to signal unavailability in English
        }
    }

    /**
     * Fetch and store transcript for a specific module
     */
    async fetchAndStoreTranscript(moduleId: number, videoUrl: string): Promise<string | null> {
        try {
            const videoId = this.extractVideoId(videoUrl);
            if (!videoId) throw new Error("Invalid video ID");

            const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
            if (!transcriptItems || transcriptItems.length === 0) throw new Error("No transcript found");

            const jointTranscript = transcriptItems.map((item: TranscriptResponse) => item.text).join(" ");

            // Ensure the transcript is in English
            const englishTranscript = await this.translateToEnglish(jointTranscript);

            // Save for future use
            await ModuleTranscript.create({
                moduleId,
                transcript: englishTranscript,
                transcriptChunks: this.chunkText(englishTranscript, 4000)
            });

            return englishTranscript;
        } catch (error) {
            console.error(`Fetch & store failed for module ${moduleId}:`, error);

            // Mark as unavailable specifically
            await ModuleTranscript.create({
                moduleId,
                transcript: "Content is not available in English transcription.",
                summary: "Transcription unavailable."
            }).catch(() => {});

            return null;
        }
    }

    /**
     * Extract YouTube video ID from URL
     */
    private extractVideoId(url: string): string | null {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : null;
    }

    /**
     * Chunk text into smaller pieces
     */
    private chunkText(text: string, size: number): string[] {
        const chunks = [];
        for (let i = 0; i < text.length; i += size) {
            chunks.push(text.substring(i, i + size));
        }
        return chunks;
    }

    /**
     * Generates a tailored educational summary based on full module metadata.
     */
    async generateQuickSummary(details: {
        title: string;
        description: string;
        category?: string;
        skills?: string[];
        targetUserGroup?: string;
        difficulty?: string;
    }): Promise<string> {
        try {
            const { title, description, category, skills, targetUserGroup, difficulty } = details;

            const prompt = `Create a professional, structured educational summary in Markdown.
            Tailor the explanation specifically for the FOLLOWING CONTEXT:
            - **Topic**: ${title}
            - **Category**: ${category || "General Education"}
            - **Target Audience**: ${targetUserGroup || "General Learner"}
            - **Learning Level**: ${difficulty || "Intermediate"}
            - **Keywords/Skills**: ${skills?.join(", ") || "N/A"}
            
            OBJECTIVE: ${description}
            
            STRICT STRUCTURE:
            - ## Concept Overview (Explain for a ${targetUserGroup || "General Learner"})
            - ## Key Principles
            - ## Practical Application
            - ## Summary for ${difficulty || "Intermediate"} level`;

            return await getChatCompletion(prompt, {
                temperature: 0.2,
                max_tokens: 1500,
                systemPrompt: `You are an expert educator specializing in ${category || "various topics"}. You create structured Markdown notes tailored to specific audiences.`
            });
        } catch (error) {
            console.error("Quick summary failed:", error);
            return `## ${details.title}\n\n${details.description}\n\n*Summary generation currently unavailable.*`;
        }
    }

    /**
     * Get or create transcript and summary for a module
     */
    async getOrCreateTranscriptAndSummary(moduleId: number, userId?: number, force: boolean = false): Promise<any> {
        try {
            const record = await ModuleTranscript.findOne({ where: { moduleId } });

            if (!record) return null;

            // If summary is missing or is the failure message, try to generate it
            const isFailed = record.summary && (record.summary.includes("failed") || record.summary.length < 100);
            const needsSummary = force || !record.summary || isFailed;

            if (needsSummary && record.transcript) {
                console.log(
                    `${force ? "Forcing re-generation" : "Generating/Refining"} summary for module ${moduleId}`
                );
                const module = await LearningModule.findByPk(moduleId);
                const summary = await this.generateQuickSummary({
                    title: module?.title || "Educational Module",
                    description: module?.description || "Learning content",
                    category: module?.category || undefined,
                    skills: module?.skillTags || undefined,
                    targetUserGroup: module?.targetUserGroups?.[0] || undefined,
                    difficulty: module?.difficulty || undefined
                });

                if (summary && !summary.includes("failed")) {
                    await record.update({ summary });
                }
            }

            return record;
        } catch (error) {
            console.error(`Error in getOrCreateTranscriptAndSummary for module ${moduleId}:`, error);
            return null;
        }
    }
}

export const transcriptService = new TranscriptService();
