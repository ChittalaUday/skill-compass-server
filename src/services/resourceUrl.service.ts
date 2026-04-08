/**
 * Resource URL Service
 * Finds and validates real educational resources (videos, articles, thumbnails) from public APIs and web.
 */

import axios from "axios";

export class ResourceUrlService {
    private youtubeApiKey: string;
    private pixabayApiKey: string;

    constructor() {
        this.youtubeApiKey = process.env.YOUTUBE_API_KEY || "";
        this.pixabayApiKey = process.env.PIXABAY_API_KEY || "";

        if (!this.youtubeApiKey) {
            console.warn("⚠️ YouTube API Key is missing! Video search will fail.");
        }
    }

    /**
     * Find educational video URL using YouTube API with validation
     */
    async findVideoUrl(topic: string, _durationMinutes?: number): Promise<string | null> {
        if (!this.youtubeApiKey) return null;

        const searchQueries = [`${topic} tutorial educational in English`, `${topic} course explanation`, `${topic}`];

        for (const query of searchQueries) {
            try {
                const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
                    params: {
                        part: "snippet",
                        q: query,
                        type: "video",
                        videoEmbeddable: "true",
                        maxResults: 3,
                        key: this.youtubeApiKey,
                        relevanceLanguage: "en",
                        safeSearch: "strict"
                    },
                    timeout: 5000
                });

                if (response.data.items && response.data.items.length > 0) {
                    // Check duration if provided, but only as a preference
                    const videoId = response.data.items[0].id.videoId;
                    return `https://www.youtube.com/watch?v=${videoId}`;
                }
            } catch (error: any) {
                console.error(`YouTube API error for query "${query}":`, error.message || error);

                // If it's a quota error or something critical, stop trying
                if (error.response?.status === 403) break;
            }
        }

        return null;
    }

    /**
     * Find reading resources (Wikipedia, Britannica, official docs, etc.) using AI suggestion and verification
     */
    async findReadingResources(topic: string): Promise<string[]> {
        try {
            const { getJsonCompletion } = await import("./groq.js");

            const prompt = `Find 5 high-quality, publicly accessible educational reading URLs (articles, documentation, wiki) for the topic: "${topic}".
            Focus on stable, reputable websites like:
            - en.wikipedia.org
            - britannica.com
            - khanacademy.org
            - w3schools.com / developer.mozilla.org (if technical)
            - healthline.com (if medical)
            - investopedia.com (if finance)
            
            Return ONLY a JSON array of strings containing the URLs. 
            Rules:
            1. NO PDFs.
            2. NO login-walled content.
            3. Ensure links are direct to an article about the topic.`;

            const suggestedUrls = await getJsonCompletion<string[]>(prompt, {
                temperature: 0.2,
                max_tokens: 500,
                systemPrompt: "You are a research assistant. Provide valid, live URLs to educational content."
            });

            if (!Array.isArray(suggestedUrls)) return [];

            // Verify each URL concurrently
            const verificationResults = await Promise.all(
                suggestedUrls.map(async (url) => {
                    const isValid = await this.verifyUrlContent(url);
                    return isValid ? url : null;
                })
            );

            return verificationResults.filter((url): url is string => url !== null).slice(0, 3);
        } catch (error) {
            console.error(`Error finding reading resources for ${topic}:`, error);
            return [];
        }
    }

    /**
     * Light verification of URL existence and reachability using HEAD/GET
     */
    async verifyUrlContent(url: string): Promise<boolean> {
        try {
            // Try HEAD request first (faster)
            const response = await axios.head(url, {
                timeout: 3000,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
                }
            });

            return response.status >= 200 && response.status < 400;
        } catch (_error) {
            // Some sites block HEAD, try a minimal GET request
            try {
                const response = await axios.get(url, {
                    timeout: 4000,
                    headers: {
                        Range: "bytes=0-1024", // Only fetch headers/first block
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
                    }
                });
                return response.status >= 200 && response.status < 400;
            } catch (_innerError) {
                return false;
            }
        }
    }

    /**
     * Get duration filter for YouTube API
     */
    private getVideoDurationFilter(minutes?: number): string {
        if (!minutes) return "any";
        if (minutes < 4) return "short";
        if (minutes < 20) return "medium";
        return "long";
    }

    /**
     * Get thumbnail from Pixabay
     */
    async findThumbnail(topic: string): Promise<string | null> {
        if (!this.pixabayApiKey) {
            return `https://picsum.photos/seed/${encodeURIComponent(topic)}/640/360`;
        }

        try {
            const searchQuery = topic.split(" ").slice(0, 3).join(" ");
            const response = await axios.get("https://pixabay.com/api/", {
                params: {
                    key: this.pixabayApiKey,
                    q: searchQuery,
                    image_type: "photo",
                    category: "education",
                    safesearch: "true",
                    per_page: 3
                },
                timeout: 5000
            });

            if (response.data.hits && response.data.hits.length > 0) {
                return response.data.hits[0].webformatURL;
            }
        } catch (error) {
            console.error("Pixabay API error:", error);
        }

        return `https://picsum.photos/seed/${encodeURIComponent(topic)}/640/360`;
    }

    /**
     * Generate format metadata
     */
    getFormatMetadata(moduleType: string, durationMinutes: number): any {
        const formats: any = {
            course: { type: "video", provider: "YouTube", quality: "HD" },
            "micro-lesson": { type: "video", provider: "YouTube", quality: "HD" },
            project: { type: "interactive", provider: "Web", quality: "N/A" },
            assessment: { type: "quiz", provider: "Platform", quality: "N/A" },
            certification: { type: "exam", provider: "External", quality: "N/A" },
            workshop: { type: "live-session", provider: "Virtual", quality: "Interactive" },
            reading: { type: "article", provider: "Web", quality: "Verified Link" }
        };

        return {
            ...(formats[moduleType] || { type: "video", provider: "YouTube", quality: "HD" }),
            duration: `${durationMinutes} minutes`,
            estimatedDuration: durationMinutes
        };
    }

    /**
     * Manual validation wrapper
     */
    async validateAndReturn(url: string | null): Promise<string | null> {
        if (!url) return null;
        return (await this.verifyUrlContent(url)) ? url : null;
    }
}

export const resourceUrlService = new ResourceUrlService();
