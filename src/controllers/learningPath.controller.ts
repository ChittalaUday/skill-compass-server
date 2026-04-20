import { Request, Response } from "express";
import { learningPathService } from "../services/learningPath.service.js";
import { transcriptService } from "../services/transcript.service.js";
import { sendResponse } from "../utils/customResponse.js";
import LearningModule from "../models/LearningModule.js";
import LearningPath from "../models/LearningPath.js";

export const learningPathController = {
    /**
     * Get authenticated user's learning path (requires authentication)
     */
    async getMyLearningPath(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;

            const learningPath = await learningPathService.getLearningPathByUserId(userId);

            if (!learningPath) {
                return sendResponse(res, false, "No learning path found", 404);
            }

            return sendResponse(res, true, "Learning path retrieved successfully", 200, learningPath);
        } catch (error: any) {
            console.error("Get Learning Path Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    },

    /**
     * Get generation status for authenticated user (requires authentication)
     */
    async getGenerationStatus(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;

            const status = await learningPathService.getGenerationStatus(userId);

            return sendResponse(res, true, "Generation status retrieved successfully", 200, status);
        } catch (error: any) {
            console.error("Get Generation Status Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    },

    /**
     * Get modules for a learning path (requires authentication + user owns the path)
     */
    async getPathModules(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;

            const learningPath = await learningPathService.getLearningPathByUserId(userId);

            if (!learningPath) {
                return sendResponse(res, false, "No learning path found", 404);
            }

            return sendResponse(res, true, "Modules retrieved successfully", 200, {
                modules: learningPath.modules
            });
        } catch (error: any) {
            console.error("Get Path Modules Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    },

    async getPathModule(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const moduleId = req.params.moduleId;

            // Fetch module directly to check ownership
            const module = await LearningModule.findByPk(Number(moduleId), {
                include: [
                    {
                        model: LearningPath,
                        as: "learningPath",
                        where: { userId }
                    }
                ]
            });

            if (!module) {
                return sendResponse(res, false, "Module not found or you don't have access to it", 404);
            }

            // Backend locking removed - frontend will handle progression

            // Fetch transcript and summary if available
            let transcriptData = null;
            try {
                transcriptData = await transcriptService.getOrCreateTranscriptAndSummary(Number(moduleId), userId);
            } catch (e) {
                console.error(`[Transcript Fetch] Error for module ${moduleId}:`, e);
            }

            return sendResponse(res, true, "Module retrieved successfully", 200, {
                ...module,
                transcript: transcriptData?.transcript || null,
                summary: transcriptData?.summary || null
            });
        } catch (error: any) {
            console.error("Get Path Module Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    },

    /**
     * Get module transcript and summary
     */
    async getModuleTranscript(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const { moduleId } = req.params;
            const { force } = req.query;

            // First verify user is authorized (owns the path containing this module)
            const moduleExists = await LearningModule.findByPk(Number(moduleId), {
                include: [
                    {
                        model: LearningPath,
                        as: "learningPath",
                        where: { userId }
                    }
                ]
            });

            if (!moduleExists) {
                return sendResponse(res, false, "Module not found in your learning history", 404);
            }

            // Backend locking removed - frontend will handle progression

            const transcriptData = await transcriptService.getOrCreateTranscriptAndSummary(
                Number(moduleId),
                userId,
                force === "true"
            );

            if (!transcriptData) {
                return sendResponse(res, false, "Transcription not available for this module", 404);
            }

            return sendResponse(res, true, "Transcription retrieved successfully", 200, transcriptData);
        } catch (error: any) {
            console.error("Get Module Transcript Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    },

    /**
     * Force re-summarize a module (requires authentication)
     */
    async resummarizeModule(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const { moduleId } = req.params;

            // First verify user is authorized (owns the path containing this module)
            const moduleExists = await LearningModule.findByPk(Number(moduleId), {
                include: [
                    {
                        model: LearningPath,
                        as: "learningPath",
                        where: { userId }
                    }
                ]
            });

            if (!moduleExists) {
                return sendResponse(res, false, "Module not found in your learning history", 404);
            }

            // Force regeneration
            const transcriptData = await transcriptService.getOrCreateTranscriptAndSummary(
                Number(moduleId),
                userId,
                true // force = true
            );

            return sendResponse(res, true, "Summary regeneration started", 200, transcriptData);
        } catch (error: any) {
            console.error("Resummarize Module Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    },

    /**
     * Regenerate learning path (requires authentication)
     * Only allowed if previous generation is completed or failed
     */
    async regeneratePath(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;

            // Backend now allows restarting even if one is in progress
            // Trigger regeneration
            await learningPathService.generateLearningPath(userId);

            return sendResponse(res, true, "Learning path regeneration started", 200, {
                status: "inprogress",
                message: "Your learning path is being regenerated. You will be notified when it's ready."
            });
        } catch (error: any) {
            console.error("Regenerate Path Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    }
};
