import { Router } from "express";
import { learningProgressController } from "../../controllers/learningProgress.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { accessMiddleware } from "../../middleware/access.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(accessMiddleware);

// Get all my progress
router.get("/my-progress", learningProgressController.getMyProgress);

// Get progress for a specific module
router.get("/module/:moduleId", learningProgressController.getModuleProgress);

// Update progress for a module
router.post("/module/:moduleId", learningProgressController.updateModuleProgress);

// Mark module as completed
router.post("/module/:moduleId/complete", learningProgressController.completeModule);

export default router;
