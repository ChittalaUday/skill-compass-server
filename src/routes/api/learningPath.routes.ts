import { Router } from "express";
import { learningPathController } from "../../controllers/learningPath.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { accessMiddleware, requireGroup } from "../../middleware/access.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(accessMiddleware);

// Get my learning path - excludes KIDS (they don't have learning paths)
router.get(
    "/my-path",
    requireGroup("TEENS", "COLLEGE_STUDENTS", "PROFESSIONALS", "SENIORS"),
    learningPathController.getMyLearningPath
);

// Get generation status - excludes KIDS
router.get(
    "/status",
    requireGroup("TEENS", "COLLEGE_STUDENTS", "PROFESSIONALS", "SENIORS"),
    learningPathController.getGenerationStatus
);

// Get modules for a path - excludes KIDS
router.get(
    "/modules",
    requireGroup("TEENS", "COLLEGE_STUDENTS", "PROFESSIONALS", "SENIORS"),
    learningPathController.getPathModules
);

// Get specific module of user - excludes KIDS
router.get(
    "/modules/:moduleId",
    requireGroup("TEENS", "COLLEGE_STUDENTS", "PROFESSIONALS", "SENIORS"),
    learningPathController.getPathModule
);

// Get module transcript and summary
router.get(
    "/modules/:moduleId/transcript",
    requireGroup("TEENS", "COLLEGE_STUDENTS", "PROFESSIONALS", "SENIORS"),
    learningPathController.getModuleTranscript
);

// Force re-summarize a module
router.post(
    "/modules/:moduleId/resummarize",
    requireGroup("TEENS", "COLLEGE_STUDENTS", "PROFESSIONALS", "SENIORS"),
    learningPathController.resummarizeModule
);

// Regenerate learning path - excludes KIDS
router.post(
    "/regenerate",
    requireGroup("TEENS", "COLLEGE_STUDENTS", "PROFESSIONALS", "SENIORS"),
    learningPathController.regeneratePath
);

export default router;
