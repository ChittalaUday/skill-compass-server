import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

// Standard high-quality chat models.
// We explicitly EXCLUDE specialized models (like guard, vision, or preview)
// to avoid common 400 errors seen in logs.
const ALLOWED_CHAT_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "llama3-8b-8192"];

const MAX_RETRIES = 3;
const BLOCK_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours

// Load all available API keys
const API_KEYS = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4
].filter((key): key is string => !!key);

// Initialize clients for each key
const clients = API_KEYS.map((key) => ({
    key,
    groq: new Groq({ apiKey: key })
}));

// Tracking blocks: Map<"keyIndex:modelName" | "keyIndex:GLOBAL", timestamp>
const blockedUntil = new Map<string, number>();

export interface GroqCompletionOptions {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    systemPrompt?: string;
}

/**
 * Main execution wrapper with API Key rotation and Model fallback
 */
async function withExecutionFallback<T>(
    operation: (groq: Groq, model: string) => Promise<T>,
    requestedModel?: string
): Promise<T> {
    const now = Date.now();
    let lastError: any;

    // Try each API key in order
    for (let keyIdx = 0; keyIdx < clients.length; keyIdx++) {
        const { key, groq } = clients[keyIdx];

        // Skip if this specific key is globally blocked
        if (blockedUntil.has(`${keyIdx}:GLOBAL`) && now < (blockedUntil.get(`${keyIdx}:GLOBAL`) || 0)) {
            continue;
        }

        // Prepare models to try for this key
        const modelsToTry =
            requestedModel && ALLOWED_CHAT_MODELS.includes(requestedModel)
                ? [requestedModel, ...ALLOWED_CHAT_MODELS.filter((m) => m !== requestedModel)]
                : ALLOWED_CHAT_MODELS;

        for (const model of modelsToTry) {
            const blockId = `${keyIdx}:${model}`;

            // Skip if this (key, model) combo is blocked
            if (blockedUntil.has(blockId) && now < (blockedUntil.get(blockId) || 0)) {
                continue;
            }

            try {
                console.log(`🤖 [Key ${keyIdx + 1}] Attempting Groq completion with model: ${model}`);
                return await operation(groq, model);
            } catch (error: any) {
                const status = error.status || 0;
                const message = error.message || "";

                console.error(`❌ [Key ${keyIdx + 1}] Groq failure for model ${model}:`, { status, message });
                lastError = error;

                // Permanent error categorization (e.g., 400 for model terms or invalid model type)
                // We block this specific model/key combo for 5 hours as requested.
                const isRetryableWithError = status === 429 || status === 503 || status === 500 || status === 413;
                const isPermanentForModel =
                    status === 400 || message.includes("not support") || message.includes("terms acceptance");

                if (isPermanentForModel || isRetryableWithError) {
                    console.warn(`⏳ Blocking model ${model} on Key ${keyIdx + 1} for 5 hours...`);
                    blockedUntil.set(blockId, Date.now() + BLOCK_DURATION_MS);
                }

                // If it's a rate limit on the key itself (429), or a major failure, we might consider switching keys
                if (status === 429) {
                    console.log(`🔄 [Key ${keyIdx + 1}] Rate limited. Switching to next API key...`);
                    break; // Exit model loop, try next key
                }

                console.log(`🔄 Switching to next available model...`);
                continue;
            }
        }
    }

    throw lastError || new Error("All Groq API keys and models exhausted or blocked.");
}

/**
 * Generates a standard chat completion (string output).
 */
export async function getChatCompletion(prompt: string, options: GroqCompletionOptions = {}): Promise<string> {
    const { temperature = 0.7, max_tokens = 1024, systemPrompt, model: requestedModel } = options;

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    return withExecutionFallback(async (groq, model) => {
        const completion = await groq.chat.completions.create({
            messages,
            model,
            temperature,
            max_tokens
        });
        return completion.choices[0]?.message?.content || "";
    }, requestedModel);
}

/**
 * Generates a JSON output.
 */
export async function getJsonCompletion<T = any>(prompt: string, options: GroqCompletionOptions = {}): Promise<T> {
    const {
        temperature = 0.3,
        max_tokens = 2048,
        systemPrompt = "You are a helpful assistant that outputs strictly in JSON format.",
        model: requestedModel
    } = options;

    const finalSystemPrompt = systemPrompt.includes("JSON")
        ? systemPrompt
        : `${systemPrompt} Output strictly in JSON format.`;

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: prompt }
    ];

    return withExecutionFallback(async (groq, model) => {
        const completion = await groq.chat.completions.create({
            messages,
            model,
            // @ts-ignore
            response_format: { type: "json_object" },
            temperature,
            max_tokens
        });

        const content = completion.choices[0]?.message?.content || "{}";
        try {
            return JSON.parse(content) as T;
        } catch (_error) {
            console.error(`Failed to parse JSON response from model ${model}:`, content);
            throw new Error(`Failed to parse JSON response from LLM (${model})`);
        }
    }, requestedModel);
}

/**
 * Vision completion (if needed, although usually bypassed in general path gen)
 */
export async function getVisionCompletion(
    prompt: string,
    imageUrl: string,
    options: GroqCompletionOptions = {}
): Promise<string> {
    const { temperature = 0.5, max_tokens = 1024, systemPrompt, model } = options;
    const visionModel = model || "llama-3.2-11b-vision-preview";

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({
        role: "user",
        content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
        ]
    });

    return withExecutionFallback(async (groq, m) => {
        const completion = await groq.chat.completions.create({
            messages,
            model: m,
            temperature,
            max_tokens
        });
        return completion.choices[0]?.message?.content || "";
    }, visionModel);
}
