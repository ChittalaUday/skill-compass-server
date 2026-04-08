import {
    User,
    UserPreferences,
    LearningPath,
    LearningModule,
    Skill,
    Interest,
    Course,
    Branches,
    LearningSchedule,
    UserModuleProgress,
    ModuleTranscript
} from "../models/index.js";
import { getJsonCompletion } from "./groq.js";
import { websocketService } from "./websocket.service.js";
import { resourceUrlService } from "./resourceUrl.service.js";
import { promptService, UserContext } from "./prompt.service.js";
import { transcriptService } from "./transcript.service.js";
import sequelize from "../config/db.js";
import { QueryTypes } from "sequelize";

interface GeneratedModule {
    title: string;
    description: string;
    moduleType: "course" | "micro-lesson" | "project" | "assessment" | "certification" | "workshop" | "reading";
    difficulty: "beginner" | "intermediate" | "advanced" | "expert";
    duration: number;
    skillTags: string[];
    category?: string;
    subcategory?: string;
    searchKeywords?: string;
    prerequisites?: string[];
}

interface GeneratedPath {
    name: string;
    description: string;
    modules: GeneratedModule[];
    metadata?: any;
}

class LearningPathService {
    /**
     * Main function to generate learning path for a user
     */
    async generateLearningPath(userId: number): Promise<void> {
        try {
            // Fetch user data
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error("User not found");
            }

            // Skip generation for KIDS
            if (user.group === "KIDS") {
                console.log(`Skipping learning path generation for KIDS user ${userId}`);
                return;
            }

            // Fetch user preferences
            const preferences = await UserPreferences.findOne({ where: { userId } });
            if (!preferences) {
                throw new Error("User preferences not found");
            }

            // Fetch skills for module search
            const skillIds = preferences.skillIds || [];

            // Fetch the most recent learning path
            let learningPath = await LearningPath.findOne({
                where: { userId },
                order: [["createdAt", "DESC"]]
            });

            let learningPathId: number;
            let shouldCreateNew = false;

            if (learningPath) {
                // If the current path is completed, check if user finished it
                if (learningPath.status === "completed") {
                    const isFinished = await this.isPathFinishedByUser(userId, learningPath.id);
                    if (isFinished) {
                        shouldCreateNew = true;
                    }
                }
            } else {
                shouldCreateNew = true;
            }

            if (shouldCreateNew) {
                // Create initial learning path record
                learningPath = await LearningPath.create({
                    userId,
                    name: `Learning Path for ${user.name} #${(await LearningPath.count({ where: { userId } })) + 1}`,
                    status: "inprogress",
                    userPreferencesId: preferences.id,
                    path: null
                });
                learningPathId = learningPath.id;
            } else if (learningPath) {
                console.log(`Updating/Fixing existing learning path for user ${userId}`);
                learningPathId = learningPath.id;

                // Delete old modules and schedules for this specific path
                await LearningModule.destroy({ where: { learningPathId: learningPathId } });
                await LearningSchedule.destroy({ where: { learningPathId: learningPathId } });

                // Update status to generating
                await learningPath.update({
                    status: "inprogress",
                    path: null,
                    userPreferencesId: preferences.id
                });
            } else {
                throw new Error("Failed to handle learning path record");
            }

            // Emit WebSocket event: generation started
            websocketService.emitGenerationStarted(userId, {
                learningPathId: learningPathId,
                message: "Learning path generation started"
            });

            // Start async generation (don't await)
            this.performGeneration(userId, learningPathId, user, preferences).catch((error) => {
                console.error(`Failed to generate learning path for user ${userId}:`, error);
            });
        } catch (error: any) {
            console.error(`Error initiating learning path generation for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Perform the actual generation (async)
     */
    private async performGeneration(
        userId: number,
        learningPathId: number,
        user: any,
        preferences: any
    ): Promise<void> {
        try {
            // Fetch related data
            const skills = await Skill.findAll({ where: { id: preferences.skillIds || [] } });
            const interests = await Interest.findAll({ where: { id: preferences.interestIds || [] } });

            let course = null;
            if (preferences.courseId) {
                course = await Course.findByPk(preferences.courseId);
            }
            let branch = null;
            if (preferences.branchId) {
                branch = await Branches.findByPk(preferences.branchId);
            }

            // SIMILARITY CHECK: Try to find a similar path from another user
            const similarPath = await this.findSimilarLearningPath(user, preferences);
            if (similarPath) {
                console.log(
                    `[Similarity] Found a highly similar path from user ${similarPath.userId} (Score: ${similarPath.similarityScore})`
                );
                await this.copyLearningPath(similarPath, learningPathId, userId, preferences);
                return;
            }

            // Calculate constraints in code
            const targetModuleCount = this.calculateTargetModuleCount(user.group, preferences.weeklyLearningHours);
            const difficulty = this.determineDifficulty(user, preferences);

            console.log(`[Learning Path] Generating ${targetModuleCount} fresh modules for path ${learningPathId}`);

            // Prepare user context for prompt
            const userContext: UserContext = {
                name: user.name,
                age: user.age,
                group: user.group,
                skills: skills.map((s) => s.name),
                interests: interests.map((i) => i.name),
                course: course?.name,
                branch: branch?.name,
                currentRole: preferences.currentRole,
                targetRole: preferences.targetRole,
                industry: preferences.industry,
                experience: preferences.yearsOfExperience,
                learningStyle: preferences.learningStyle,
                weeklyHours: preferences.weeklyLearningHours,
                accessibility: preferences.groupSpecificData?.accessibility
            };

            // Generate path using unified prompt system
            const prompt = promptService.generateLearningPathPrompt(userContext, {
                targetModuleCount,
                difficulty
            });

            const generatedPath = await getJsonCompletion<GeneratedPath>(prompt, {
                temperature: 0.7,
                max_tokens: 4000
            });

            // Create learning modules (all fresh)
            const moduleIds = await this.createModules(
                learningPathId,
                generatedPath.modules,
                user.group,
                preferences.courseId,
                preferences.branchId
            );

            // Update learning path with generated data
            await LearningPath.update(
                {
                    path: {
                        description: generatedPath.description,
                        modules: moduleIds,
                        metadata: generatedPath.metadata || {}
                    },
                    status: "completed",
                    generatedAt: new Date()
                },
                { where: { id: learningPathId } }
            );

            // Generate learning schedule
            await this.generateSchedule(userId, learningPathId, moduleIds, preferences.weeklyLearningHours);

            // Emit WebSocket event: generation completed
            const { websocketService } = await import("./websocket.service.js");
            websocketService.emitToUser(userId, "learning_path:completed", {
                learningPathId: learningPathId,
                message: "Your learning path is fully enriched and ready!"
            });

            console.log(`[Learning Path] Full journey completed for user ${userId}`);
        } catch (error: any) {
            console.error(`Error during learning path generation for user ${userId}:`, error);

            // Update learning path with error
            await LearningPath.update(
                {
                    status: "failed",
                    generationError: error.message || "Unknown error"
                },
                { where: { id: learningPathId } }
            );

            // Emit WebSocket event: generation failed
            websocketService.emitGenerationFailed(userId, {
                learningPathId,
                error: error.message || "Unknown error"
            });
        }
    }

    /**
     * Calculate target number of modules based on user group and learning hours
     */
    private calculateTargetModuleCount(userGroup: string, _weeklyHours: number): number {
        switch (userGroup) {
            case "COLLEGE_STUDENTS":
                return 15;
            case "PROFESSIONALS":
                return 10;
            case "TEENS":
                return 12;
            case "SENIORS":
                return 6;
            default:
                return 10;
        }
    }

    /**
     * Determine base difficulty for the path
     */
    private determineDifficulty(user: any, _preferences: any): "beginner" | "intermediate" | "advanced" | "expert" {
        if (user.group === "SENIORS") return "beginner";
        if (user.group === "TEENS") return "beginner";
        if (user.group === "PROFESSIONALS" && (_preferences.yearsOfExperience || 0) > 5) return "advanced";
        return "intermediate";
    }

    private async createModules(
        learningPathId: number,
        modules: GeneratedModule[],
        userGroup: string,
        courseId?: number,
        branchId?: number
    ): Promise<number[]> {
        const moduleIds: number[] = [];

        console.log(`[Learning Path] Creating ${modules.length} modules (Enrichment ongoing)`);
        const enrichmentPromises: Promise<void>[] = [];

        for (let index = 0; index < modules.length; index++) {
            const module = modules[index];
            const searchTerm = module.searchKeywords || module.title;

            // 1. Parallel fetch of core content IMMEDIATELY (Fast search)
            const [videoUrl, thumbnailUrl] = await Promise.all([
                resourceUrlService.findVideoUrl(searchTerm, module.duration),
                resourceUrlService.findThumbnail(searchTerm)
            ]);

            const guaranteedUrl =
                videoUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;

            const created = await LearningModule.create({
                title: module.title,
                description: module.description,
                moduleType: this.mapModuleType(module.moduleType),
                difficulty: this.mapDifficulty(module.difficulty),
                duration: module.duration,
                contentUrl: guaranteedUrl,
                thumbnailUrl: thumbnailUrl || `https://picsum.photos/seed/${encodeURIComponent(searchTerm)}/640/360`,
                skillTags: module.skillTags || [],
                category: module.category,
                subcategory: module.subcategory,
                learningPathId,
                orderInPath: index + 1,
                isAiGenerated: true,
                targetUserGroups: [userGroup],
                courseId: courseId || null,
                groupSpecificMetadata: { branchId: branchId || null },
                status: "inprogress",
                generationMetadata: {
                    message: "Transcript and summary are being generated..."
                }
            });

            moduleIds.push(created.id);

            // Queue enrichment
            const enrichment = this.enrichModuleResources(
                created.id,
                searchTerm,
                guaranteedUrl,
                index + 1,
                modules.length
            ).catch((err) => {
                console.error(`[Background Enrichment] Failed for module ${created.id}:`, err);
            });
            enrichmentPromises.push(enrichment);
        }

        // Wait for ALL modules to be enriched before returning
        await Promise.allSettled(enrichmentPromises);

        return moduleIds;
    }

    /**
     * Background resource enrichment for deep content (Transcript/Summary/links)
     */
    private async enrichModuleResources(
        moduleId: number,
        topic: string,
        videoUrl: string,
        index: number,
        total: number
    ): Promise<void> {
        try {
            console.log(`[Deep Enrichment] ${index}/${total} Starting for module ${moduleId}: ${topic}`);

            // 1. Fetch Reading Resources (converts from placeholder to real links)
            const readingResources = await resourceUrlService.findReadingResources(topic);

            // 2. Fetch/Process Transcript and Summary
            let transcript = null;
            let summary = null;

            // Logic simplified: Use context-aware Quick Summary exclusively
            const moduleForDetails = await LearningModule.findByPk(moduleId);
            summary = await transcriptService.generateQuickSummary({
                title: moduleForDetails?.title || topic,
                description: moduleForDetails?.description || "",
                category: moduleForDetails?.category || undefined,
                skills: moduleForDetails?.skillTags || undefined,
                targetUserGroup: moduleForDetails?.targetUserGroups?.[0] || undefined,
                difficulty: moduleForDetails?.difficulty || undefined
            });

            if (videoUrl && !videoUrl.includes("zOjov-2OZ0E")) {
                transcript = await transcriptService.fetchAndStoreTranscript(moduleId, videoUrl);
            }

            // 3. Update module with real content (Summary/Transcript status)
            await LearningModule.update(
                {
                    status: "completed", // New column
                    generationMetadata: {
                        generatedAt: new Date(),
                        readingResources,
                        hasTranscript: !!transcript,
                        summaryPreview: summary ? summary.substring(0, 500) + "..." : null
                    }
                },
                { where: { id: moduleId } }
            );

            // 4. Update the ModuleTranscript record with the summary
            if (transcript) {
                await ModuleTranscript.update({ summary }, { where: { moduleId } });
            }

            console.log(`[Background] Enrichment completed for module ${moduleId}`);
        } catch (error) {
            console.error(`[Background] Critical enrichment error for ${moduleId}:`, error);
            await LearningModule.update(
                {
                    generationMetadata: {
                        status: "failed",
                        error: "Failed to fetch some resources in background"
                    }
                },
                { where: { id: moduleId } }
            );
        }
    }

    /**
     * Helper to fetch video and transcript in sequence but within a parallel block
     */
    private async fetchVideoWithTranscript(topic: string, duration?: number) {
        try {
            const videoUrl = await resourceUrlService.findVideoUrl(topic, duration);
            let transcript = null;

            if (videoUrl) {
                transcript = await transcriptService.fetchTranscriptByUrl(videoUrl);
            }

            return { videoUrl, transcript };
        } catch (error) {
            console.error(`Error in fetchVideoWithTranscript for ${topic}:`, error);
            return { videoUrl: null, transcript: null };
        }
    }

    /**
     * Chunk text for database storage
     */
    private chunkTextForStorage(text: string, size: number): string[] {
        const chunks = [];
        for (let i = 0; i < text.length; i += size) {
            chunks.push(text.substring(i, i + size));
        }
        return chunks;
    }

    /**
     * Generate learning schedule based on weekly hours
     */
    private async generateSchedule(
        userId: number,
        learningPathId: number,
        moduleIds: number[],
        weeklyHours: number
    ): Promise<void> {
        // Calculate total duration
        const modules = await LearningModule.findAll({ where: { id: moduleIds } });
        const totalMinutes = modules.reduce((sum, m) => sum + (m.duration || 0), 0);

        // Calculate number of weeks needed
        const minutesPerWeek = weeklyHours * 60;
        const weeksNeeded = Math.ceil(totalMinutes / minutesPerWeek);

        // Create weekly schedules
        const startDate = new Date();
        const schedules = [];

        for (let week = 1; week <= weeksNeeded; week++) {
            const weekStartDate = new Date(startDate);
            weekStartDate.setDate(startDate.getDate() + (week - 1) * 7);

            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekStartDate.getDate() + 6);

            schedules.push({
                userId,
                learningPathId,
                periodType: "weekly" as const,
                periodNumber: week,
                startDate: weekStartDate,
                endDate: weekEndDate,
                scheduleData: {
                    weekNumber: week,
                    allocatedHours: weeklyHours,
                    modulesToComplete: this.distributeModules(moduleIds, week, weeksNeeded)
                },
                status: week === 1 ? ("active" as const) : ("upcoming" as const),
                completionPercentage: 0
            });
        }

        await LearningSchedule.bulkCreate(schedules);
    }

    /**
     * Distribute modules across weeks
     */
    private distributeModules(moduleIds: number[], currentWeek: number, totalWeeks: number): number[] {
        const modulesPerWeek = Math.ceil(moduleIds.length / totalWeeks);
        const startIndex = (currentWeek - 1) * modulesPerWeek;
        const endIndex = Math.min(startIndex + modulesPerWeek, moduleIds.length);
        return moduleIds.slice(startIndex, endIndex);
    }

    /**
     * Get learning path by userId
     */
    async getLearningPathByUserId(userId: number) {
        const learningPath = await LearningPath.findOne({
            where: { userId },
            order: [["createdAt", "DESC"]]
        });

        if (!learningPath) {
            return null;
        }

        // Fetch associated modules
        const modules = await LearningModule.findAll({
            where: { learningPathId: learningPath.id },
            order: [["orderInPath", "ASC"]]
        });

        // Fetch user progress for these modules
        const progress = await UserModuleProgress.findAll({
            where: {
                userId,
                moduleId: modules.map((m) => m.id)
            }
        });

        const progressMap = new Map(progress.map((p) => [p.moduleId, p.status]));

        const modulesWithStatus = modules.map((module) => {
            const status = progressMap.get(module.id) || "pending";

            return {
                ...module.toJSON(),
                userStatus: status,
                isCompleted: status === "completed"
            };
        });

        return {
            ...learningPath.toJSON(),
            modules: modulesWithStatus
        };
    }

    /**
     * Get generation status
     */
    async getGenerationStatus(userId: number) {
        const learningPath = await LearningPath.findOne({
            where: { userId },
            order: [["createdAt", "DESC"]]
        });

        if (!learningPath) {
            return {
                exists: false,
                status: null,
                message: "No learning path found"
            };
        }

        return {
            exists: true,
            status: learningPath.status,
            generatedAt: learningPath.generatedAt,
            error: learningPath.generationError
        };
    }

    /**
     * Check if a user has finished all modules in a specific learning path
     */
    private async isPathFinishedByUser(userId: number, learningPathId: number): Promise<boolean> {
        const modules = await LearningModule.findAll({
            where: { learningPathId }
        });

        if (modules.length === 0) return true;

        const moduleIds = modules.map((m) => m.id);
        const progress = await UserModuleProgress.findAll({
            where: {
                userId,
                moduleId: moduleIds,
                status: "completed"
            }
        });

        return progress.length === moduleIds.length;
    }

    /**
     * Finds a similar learning path from another user using a point-based system
     */
    private async findSimilarLearningPath(user: any, prefs: any): Promise<any> {
        // Only search for other users in the same group
        const group = user.group;
        if (!group || group === "KIDS") return null;

        const skillIds = prefs.skillIds || [];
        const interestIds = prefs.interestIds || [];

        // Construct SQL for point-based similarity
        const query = `
            SELECT 
                lp.id as lp_id,
                lp."userId",
                lp.path,
                up.id as prefs_id,
                (
                    (CASE WHEN up."courseId" = :courseId AND :courseId IS NOT NULL THEN 25 ELSE 0 END) +
                    (CASE WHEN up."branchId" = :branchId AND :branchId IS NOT NULL THEN 25 ELSE 0 END) +
                    (CASE WHEN up."industry" = :industry AND :industry IS NOT NULL THEN 15 ELSE 0 END) +
                    (CASE WHEN up."targetRole" = :targetRole AND :targetRole IS NOT NULL THEN 15 ELSE 0 END) +
                    (COALESCE((SELECT COUNT(*) FROM unnest(up."skillIds") s WHERE s = ANY(ARRAY[:skillIds])), 0) * 8) +
                    (COALESCE((SELECT COUNT(*) FROM unnest(up."interestIds") i WHERE i = ANY(ARRAY[:interestIds])), 0) * 8)
                ) as "similarityScore"
            FROM learning_paths lp
            JOIN user_preferences up ON lp."userId" = up."userId"
            JOIN users u ON lp."userId" = u.id
            WHERE 
                lp.status = 'completed' AND 
                lp."userId" != :userId AND
                u."group" = :group
            ORDER BY "similarityScore" DESC
            LIMIT 1
        `;

        const results: any[] = await sequelize.query(query, {
            replacements: {
                userId: user.id,
                group: group,
                courseId: prefs.courseId || null,
                branchId: prefs.branchId || null,
                industry: prefs.industry || null,
                targetRole: prefs.targetRole || null,
                skillIds: skillIds.length > 0 ? skillIds : [0],
                interestIds: interestIds.length > 0 ? interestIds : [0]
            },
            type: QueryTypes.SELECT
        });

        if (results.length > 0 && results[0].similarityScore >= 40) {
            return results[0];
        }

        return null;
    }

    /**
     * Copies an existing learning path's modules and structure to a new path
     */
    private async copyLearningPath(source: any, targetPathId: number, targetUserId: number, prefs: any): Promise<void> {
        console.log(`[Similarity] Cloning modules from path ${source.lp_id} to ${targetPathId}`);

        // 1. Fetch source modules
        const sourceModules = await LearningModule.findAll({
            where: { learningPathId: source.lp_id },
            order: [["orderInPath", "ASC"]]
        });

        const newModuleIds: number[] = [];

        // 2. Clone each module
        for (const mod of sourceModules) {
            const cloned = await LearningModule.create({
                title: mod.title,
                description: mod.description,
                moduleType: mod.moduleType,
                format: mod.format,
                difficulty: mod.difficulty,
                duration: mod.duration,
                contentUrl: mod.contentUrl,
                thumbnailUrl: mod.thumbnailUrl,
                category: mod.category,
                subcategory: mod.subcategory,
                skillTags: mod.skillTags,
                prerequisiteModules: [], // Re-map later if needed, but simple clone for now
                targetUserGroups: mod.targetUserGroups,
                groupSpecificMetadata: mod.groupSpecificMetadata,
                courseId: mod.courseId,
                learningPathId: targetPathId,
                orderInPath: mod.orderInPath,
                isAiGenerated: false, // It's a clone
                generationMetadata: {
                    clonedFromPath: source.lp_id,
                    clonedFromModule: mod.id,
                    clonedAt: new Date()
                }
            });
            newModuleIds.push(cloned.id);
        }

        // 3. Update the path record
        const pathData = source.path || {};
        await LearningPath.update(
            {
                path: {
                    ...pathData,
                    modules: newModuleIds,
                    cloned: true,
                    sourceUserId: source.userId
                },
                status: "completed",
                generatedAt: new Date()
            },
            { where: { id: targetPathId } }
        );

        // 4. Generate schedule
        await this.generateSchedule(targetUserId, targetPathId, newModuleIds, prefs.weeklyLearningHours);

        // 5. Emit WebSocket event
        websocketService.emitGenerationCompleted(targetUserId, {
            learningPathId: targetPathId,
            message: "Learning path assigned based on similar profiles",
            path: {
                name: source.path?.name || "Learning Path",
                description: source.path?.description || "",
                modules: sourceModules.map((m) => m.toJSON()),
                metadata: source.path?.metadata || {}
            }
        });

        console.log(`[Similarity] Successfully cloned path for user ${targetUserId}`);
    }

    /**
     * Map AI-generated difficulty to valid enum values
     */
    private mapDifficulty(difficulty: string): "beginner" | "intermediate" | "advanced" | "expert" {
        const d = difficulty?.toLowerCase() || "";
        if (d.includes("beginner") || d.includes("foundational") || d.includes("basic") || d.includes("entry"))
            return "beginner";
        if (d.includes("advanced") || d.includes("hard")) return "advanced";
        if (d.includes("expert") || d.includes("pro") || d.includes("master")) return "expert";
        return "intermediate";
    }

    /**
     * Map AI-generated module type to valid enum values
     */
    private mapModuleType(
        type: string
    ): "course" | "micro-lesson" | "project" | "assessment" | "certification" | "workshop" | "reading" {
        const t = type?.toLowerCase() || "";
        if (t.includes("course")) return "course";
        if (t.includes("micro") || t.includes("lesson")) return "micro-lesson";
        if (t.includes("project")) return "project";
        if (t.includes("assessment") || t.includes("test") || t.includes("quiz")) return "assessment";
        if (t.includes("certification") || t.includes("cert")) return "certification";
        if (t.includes("workshop") || t.includes("seminar")) return "workshop";
        if (t.includes("reading") || t.includes("article") || t.includes("book")) return "reading";
        return "course";
    }
}

export const learningPathService = new LearningPathService();
