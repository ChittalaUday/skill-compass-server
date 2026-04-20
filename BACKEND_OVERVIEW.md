# Skill Compass - Complete Backend Technical Index

This document provides an exhaustive index of all files in the Skill Compass backend, their roles, and how they contribute to the application's functionality.

---

## 📂 Core Application Files
- **`src/index.ts`**: The entry point of the application. Initializes the HTTP server and starts the database connection.
- **`src/app.ts`**: Configures the Express application, including global middleware (CORS, JSON parsing), security headers, and attaches the main router.
- **`src/config/db.ts`**: Database configuration using Sequelize. Handles connections to local Postgres, Neon, or AWS RDS with SSL support.
- **`src/config/app.config.ts`**: Centralized configuration for environment variables (JWT secrets, API keys, Port settings).

---

## 🗄️ Database Models (`src/models/`)
Each file represents a table in the PostgreSQL database.
- **`index.ts`**: The "Relationship Hub". Defines all Sequelize associations (1:1, 1:N, N:M).
- **`User.ts`**: Core user profile (email, password, age, group, onboarding status).
- **`UserPreferences.ts`**: Stores interests, skills, selected courses, and group-specific profiling data.
- **`LearningPath.ts`**: Stores the AI-generated sequence of learning modules for a user.
- **`LearningModule.ts`**: Individual educational units (videos, articles, quizzes).
- **`UserModuleProgress.ts`**: Tracks completion status and ratings for each module per user.
- **`Course.ts` & `Branches.ts`**: Static catalog of educational degrees and specializations.
- **`Interest.ts` & `Skill.ts`**: Pre-defined library of skills and interests for onboarding.
- **`Assessment.ts`**: Quizzes and tests linked to learning modules.
- **`Certification.ts` & `UserCertification.ts`**: Global certification catalog and user's earned certificates.
- **`LearningSchedule.ts`**: User-defined study time slots and reminders.
- **`AiAnalysis.ts`**: Logs of AI-driven insights about user performance or personality.
- **`EducationalResource.ts`**: External links and resources mapped to topics.
- **`KidDrawingImage.ts`**: Stores metadata for drawings uploaded by kids.
- **`ModuleTranscript.ts`**: AI-generated transcripts and summaries for video content.
- **`UserPortfolio.ts`**: Aggregated user achievements and progress summary.

---

## 🧠 Business Logic & Services (`src/services/`)
Services contain the "heavy lifting" logic of the application.
- **`aiGenerate.service.ts`**: Handles AI-driven course syncing, generation, and icon enrichment.
- **`learningPath.service.ts`**: The core AI engine that constructs personalized learning paths using Groq.
- **`onboarding.service.ts`**: Manages the multi-step profiling flow for different user demographics.
- **`prediction.service.ts`**: Uses AI to recommend the best Courses and Branches based on user interests/skills.
- **`groq.ts`**: Low-level wrapper for the Groq Cloud API (handling JSON completions and retries).
- **`websocket.service.ts`**: Manages real-time Socket.io connections for live generation updates.
- **`transcript.service.ts`**: Fetches and processes YouTube transcripts using AI for summarization.
- **`moduleSearch.service.ts`**: Logic for searching and filtering learning modules.
- **`access.service.ts`**: Calculates granular feature permissions based on user status/group.
- **`resourceUrl.service.ts`**: Validates and processes external resource URLs.
- **`prompt.service.ts`**: Centralized store for complex AI system prompts.

---

## 🛡️ Middleware (`src/middleware/`)
- **`auth.middleware.ts`**: JWT verification and user injection into `req.user`.
- **`access.middleware.ts`**: RBAC (Role-Based Access Control) and group-based route protection.
- **`validate.middleware.ts`**: Generic wrapper for Joi/Zod request validation.
- **`errLogger.ts`**: Centralized error logging and formatting for production.

---

## 🚦 API Routes (`src/routes/`)
- **`app.routes.ts`**: The main router that prefixes and mounts all API modules.
- **`api/auth.route.ts`**: Login, registration, and password management.
- **`api/onboarding.route.ts`**: Specialized endpoints for each user group's profile setup.
- **`api/learningPath.routes.ts`**: Triggering, fetching, and updating AI paths.
- **`api/learningProgress.routes.ts`**: Marking modules as complete and tracking stats.
- **`api/kids.route.ts`**: Kid-specific features (drawing, simplified learning).
- **`api/users.route.ts`**: Profile updates, portfolio fetching, and settings.
- **`api/admin.route.ts`**: System management and AI data syncing tools.
- **`api/common.route.ts`**: Public data like skills, interests, and course lists.
- **`api/clip.route.ts`**: Global AI search and discovery.
- **`api/learningSchedule.routes.ts`**: Calendar and schedule management.

---

## 🎮 Controllers (`src/controllers/`)
Controllers bridge the gap between Routes and Services.
- `auth.controller.ts`, `onboarding.controller.ts`, `learningPath.controller.ts`, etc. (Corresponding to each route).

---

## 📊 GraphQL Layer (`src/graphql/`)
- **`typeDefs.ts`**: SDL (Schema Definition Language) for the GraphQL API.
- **`resolvers.ts`**: Logic for resolving GraphQL queries and mutations.
- **`server.ts`**: Apollo Server configuration and middleware integration.
- **`index.ts`**: Entry point for mounting GraphQL on the Express app.

---

## 🛠️ Utilities & Support
- **`src/utils/customResponse.ts`**: Standardized JSON response structure.
- **`src/utils/urlValidator.ts`**: Helper for cleaning and verifying external links.
- **`src/validations/`**: Detailed Joi/Zod schemas for every incoming request.
- **`src/migrations/`**: Historical record of database schema changes.
- **`src/seeders/`**: Scripts for populating the database with initial/test data.
- **`src/scripts/`**: One-off maintenance and verification scripts.
- **`src/types/`**: TypeScript interfaces and global namespace augmentations.

---

## 🚀 Key Architectural Approaches
1.  **Group-Based Segmentation**: The entire application logic (onboarding, permissions, paths) is branched by the `group` enum (KIDS, TEENS, etc.).
2.  **Asynchronous AI**: High-latency AI calls use WebSockets to notify the frontend of progress.
3.  **JSONB Extensibility**: Using Postgres JSONB allows for rapid feature iteration without frequent migration changes.
4.  **Surgical Validations**: Every endpoint is shielded by a validation layer, ensuring only clean data enters the services.
