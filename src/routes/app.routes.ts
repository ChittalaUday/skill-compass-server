import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import userRoutes from "./api/users.route.js";
import clipRoutes from "./api/clip.route.js";
import authRoutes from "./api/auth.route.js";
import onboardingRoutes from "./api/onboarding.route.js";
import commonRoutes from "./api/common.route.js";
import learningPathRoutes from "./api/learningPath.routes.js";
import learningProgressRoutes from "./api/learningProgress.routes.js";
import learningScheduleRoutes from "./api/learningSchedule.routes.js";
import adminRoutes from "./api/admin.route.js";
import kidsRoutes from "./api/kids.route.js";
import { sendResponse } from "../utils/customResponse.js";

const routes = Router();

routes.get("/", (re: Request, res: Response) => {
    sendResponse(res, true, "😎 Api is Working..");
});

routes.use("/users", userRoutes);
routes.use("/auth", authRoutes);
routes.use("/clip", clipRoutes);
routes.use("/onboarding", onboardingRoutes);
routes.use("/common", commonRoutes);
routes.use("/learning-path", learningPathRoutes);
routes.use("/learning-progress", learningProgressRoutes);
routes.use("/learning-schedule", learningScheduleRoutes);
routes.use("/admin", adminRoutes);
routes.use("/kids", kidsRoutes);

// 404 Handler - after all routes
routes.use((req: Request, res: Response) => {
    sendResponse(res, false, `${req.url} is not found`, 404);
});

// Global Error Handler for this router
routes.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[API Error] ${req.method} ${req.url}:`, err);
    sendResponse(res, false, err.message || "Internal Server Error", err.status || 500);
});
export default routes;
