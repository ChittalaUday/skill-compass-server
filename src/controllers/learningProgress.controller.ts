import { Request, Response } from "express";
import { UserModuleProgress, Op } from "../models/index.js";
import { sendResponse } from "../utils/customResponse.js";

export const learningProgressController = {
    /**
     * Get all progress for authenticated user (requires authentication)
     */
    async getMyProgress(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;

            const progress = await UserModuleProgress.findAll({
                where: { userId },
                order: [["updatedAt", "DESC"]]
            });

            return sendResponse(res, true, "Progress retrieved successfully", 200, progress);
        } catch (error: any) {
            console.error("Get Progress Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    },

    /**
     * Get progress for a specific module (requires authentication)
     */
    async getModuleProgress(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const moduleId = parseInt(String(req.params.moduleId));

            if (isNaN(moduleId)) {
                return sendResponse(res, false, "Invalid module ID", 400);
            }

            const progress = await UserModuleProgress.findOne({
                where: { userId, moduleId }
            });

            if (!progress) {
                return sendResponse(res, false, "Progress not found for this module", 404);
            }

            return sendResponse(res, true, "Module progress retrieved successfully", 200, progress);
        } catch (error: any) {
            console.error("Get Module Progress Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    },

    /**
     * Update progress for a module (requires authentication)
     */
    async updateModuleProgress(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const moduleId = parseInt(String(req.params.moduleId));

            if (isNaN(moduleId)) {
                return sendResponse(res, false, "Invalid module ID", 400);
            }

            const {
                status,
                progressPercentage,
                timeSpent,
                score,
                maxScore,
                passed,
                rating,
                feedback,
                progressData,
                testCompleted,
                testResults
            } = req.body;

            const validStatuses = ["pending", "inprogress", "completed", "failed"];
            if (status && !validStatuses.includes(status)) {
                return sendResponse(res, false, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
            }

            // Enforce test completion for 'completed' status
            if (status === "completed" && !testCompleted && !testResults) {
                // If it's already completed in DB, we're fine, otherwise we need the test info
                const existing = await UserModuleProgress.findOne({ where: { userId, moduleId } });
                if (!existing || (!existing.testCompleted && !testResults)) {
                    return sendResponse(
                        res,
                        false,
                        "Test must be completed to mark module as 'completed'. Use the /complete endpoint.",
                        400
                    );
                }
            }

            // Validate progressPercentage if provided
            if (progressPercentage !== undefined) {
                if (typeof progressPercentage !== "number" || progressPercentage < 0 || progressPercentage > 100) {
                    return sendResponse(res, false, "Progress percentage must be a number between 0 and 100", 400);
                }
            }

            // Validate rating if provided
            if (rating !== undefined) {
                if (typeof rating !== "number" || rating < 1 || rating > 5) {
                    return sendResponse(res, false, "Rating must be a number between 1 and 5", 400);
                }
            }

            let progress = await UserModuleProgress.findOne({
                where: { userId, moduleId }
            });

            if (!progress) {
                // Create new progress record
                progress = await UserModuleProgress.create({
                    userId,
                    moduleId,
                    status: status || "inprogress",
                    progressPercentage: progressPercentage || 0,
                    timeSpent,
                    score,
                    maxScore,
                    passed,
                    rating,
                    feedback,
                    testCompleted: testCompleted || false,
                    testResults: testResults || null,
                    progressData: progressData || {},
                    completedAt: status === "completed" ? new Date() : null
                });
            } else {
                // Update existing progress
                await progress.update({
                    status,
                    progressPercentage,
                    timeSpent,
                    score,
                    maxScore,
                    passed,
                    rating,
                    feedback,
                    testCompleted: testCompleted !== undefined ? testCompleted : progress.testCompleted,
                    testResults: testResults !== undefined ? testResults : progress.testResults,
                    progressData,
                    completedAt: status === "completed" ? new Date() : progress.completedAt
                });
            }

            // Update module quality metrics for reuse algorithm
            try {
                const { LearningModule } = await import("../models/index.js");
                if (status === "completed") {
                    await LearningModule.increment("completionCount", { where: { id: moduleId } });
                }
                if (rating !== undefined) {
                    const allRatings = await UserModuleProgress.findAll({
                        where: { moduleId, rating: { [Op.not]: null } },
                        attributes: ["rating"]
                    });
                    if (allRatings.length > 0) {
                        const avg = allRatings.reduce((sum, p) => sum + (p.rating || 0), 0) / allRatings.length;
                        await LearningModule.update(
                            { averageRating: parseFloat(avg.toFixed(2)) },
                            { where: { id: moduleId } }
                        );
                    }
                }
            } catch (e) {
                console.error("[Quality Update] Error:", e);
            }

            // Real-time update via WebSocket
            try {
                const { websocketService } = await import("../services/websocket.service.js");
                websocketService.emitToUser(userId, "progress:updated", {
                    moduleId,
                    status: (progress as any).status,
                    progressPercentage: (progress as any).progressPercentage,
                    message: `Module progress updated to ${status}`
                });
            } catch (wsErr) {
                console.error("[WS Progress Emit] Error:", wsErr);
            }

            return sendResponse(res, true, "Module progress updated successfully", 200, progress);
        } catch (error: any) {
            console.error("Update Module Progress Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    },

    /**
     * Mark a module as completed (requires authentication)
     */
    async completeModule(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const moduleId = parseInt(String(req.params.moduleId));

            if (isNaN(moduleId)) {
                return sendResponse(res, false, "Invalid module ID", 400);
            }

            const { testResults } = req.body;

            // testResults is optional now, providing a default if missing
            const finalTestResults = testResults || {
                completedAt: new Date(),
                source: "manual_complete",
                score: 100
            };

            let progress = await UserModuleProgress.findOne({
                where: { userId, moduleId }
            });

            if (!progress) {
                progress = await UserModuleProgress.create({
                    userId,
                    moduleId,
                    status: "completed",
                    progressPercentage: 100,
                    testCompleted: true,
                    testResults: finalTestResults,
                    completedAt: new Date()
                });
            } else {
                await progress.update({
                    status: "completed",
                    progressPercentage: 100,
                    testCompleted: true,
                    testResults: finalTestResults,
                    completedAt: new Date()
                });
            }

            // Update module completion count
            try {
                const { LearningModule } = await import("../models/index.js");
                await LearningModule.increment("completionCount", { where: { id: moduleId } });
            } catch (e) {
                console.error("[Completion Count Update] Error:", e);
            }

            // Real-time update via WebSocket
            try {
                const { websocketService } = await import("../services/websocket.service.js");
                websocketService.emitToUser(userId, "progress:updated", {
                    moduleId,
                    status: "completed",
                    isCompleted: true,
                    message: "Module marked as completed!"
                });
            } catch (wsErr) {
                console.error("[WS Progress Emit] Error:", wsErr);
            }

            return sendResponse(res, true, "Module marked as completed successfully", 200, progress);
        } catch (error: any) {
            console.error("Complete Module Error:", error);
            return sendResponse(res, false, error.message || "Internal Server Error", 500);
        }
    }
};
