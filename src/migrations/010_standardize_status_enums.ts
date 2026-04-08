import sequelize from "../config/db.js";
import { QueryTypes } from "sequelize";

export async function up() {
    console.log("Standardizing status ENUMs across tables...");

    // 1. LearningPath: generating -> inprogress
    try {
        await sequelize.query("ALTER TYPE \"enum_learning_paths_status\" RENAME VALUE 'generating' TO 'inprogress';");
        await sequelize.query(
            "ALTER TYPE \"enum_learning_paths_status\" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'inprogress';"
        );
    } catch (e) {
        console.log("LearningPath ENUM update skipped or already applied.");
    }

    // 2. LearningModule: enriching -> inprogress
    try {
        // Earlier I created 'enum_learning_modules_status' with 'enriching', 'completed', 'failed'
        await sequelize.query("ALTER TYPE \"enum_learning_modules_status\" RENAME VALUE 'enriching' TO 'inprogress';");
        await sequelize.query(
            "ALTER TYPE \"enum_learning_modules_status\" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'inprogress';"
        );
    } catch (e) {
        console.log("LearningModule ENUM update skipped or already applied.");
    }

    // 3. UserModuleProgress: not-started -> pending, in-progress -> inprogress, abandoned -> failed
    try {
        await sequelize.query(
            "ALTER TYPE \"enum_user_module_progress_status\" RENAME VALUE 'not-started' TO 'pending';"
        );
        await sequelize.query(
            "ALTER TYPE \"enum_user_module_progress_status\" RENAME VALUE 'in-progress' TO 'inprogress';"
        );
        await sequelize.query("ALTER TYPE \"enum_user_module_progress_status\" RENAME VALUE 'abandoned' TO 'failed';");
    } catch (e) {
        console.log("UserModuleProgress ENUM update skipped or already applied.");
    }

    console.log("✅ ENUMs standardized to pending, inprogress, completed, failed");
}

export async function down() {
    // Reverse logic if needed, but RENAME makes it tricky to fully revert without data loss in some DBs.
    console.log("Down migration not fully implemented for ENUM renames.");
}
