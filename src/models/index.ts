import sequelize from "../config/db.js";
import { Op } from "sequelize";
import User from "./User.js";
import Interest from "./Interest.js";
import Skill from "./Skill.js";
import Course from "./Course.js";
import Branches from "./Branches.js"; // Assuming this still exists
import LearningPath from "./LearningPath.js";
import UserPreferences from "./UserPreferences.js";
import LearningModule from "./LearningModule.js";
import UserModuleProgress from "./UserModuleProgress.js";
import Assessment from "./Assessment.js";
import Certification from "./Certification.js";
import UserCertification from "./UserCertification.js";
import UserPortfolio from "./UserPortfolio.js";
import LearningSchedule from "./LearningSchedule.js";
import AiAnalysis from "./AiAnalysis.js";
import EducationalResource from "./EducationalResource.js";
import KidDrawingImage from "./KidDrawingImage.js";
import ModuleTranscript from "./ModuleTranscript.js";

// 1. USER PREFERENCES
User.hasOne(UserPreferences, { foreignKey: "userId", as: "preferences" });
UserPreferences.belongsTo(User, { foreignKey: "userId", as: "user" });

// UserPreferences.interestIds and UserPreferences.skillIds are arrays, so no standard SQL association here
// We can handle lookups manually or via utility functions
UserPreferences.belongsTo(Course, { foreignKey: "courseId", as: "course", onDelete: "SET NULL" });
UserPreferences.belongsTo(Branches, { foreignKey: "branchId", as: "branch", onDelete: "SET NULL" });

// 2. LEARNING MODULES
LearningModule.belongsTo(Course, { foreignKey: "courseId", as: "course", onDelete: "CASCADE" });
Course.hasMany(LearningModule, { foreignKey: "courseId", as: "modules", onDelete: "CASCADE" });

// 3. USER MODULE PROGRESS
User.hasMany(UserModuleProgress, { foreignKey: "userId", as: "moduleProgress" });
UserModuleProgress.belongsTo(User, { foreignKey: "userId", as: "user" });

LearningModule.hasMany(UserModuleProgress, { foreignKey: "moduleId", as: "userProgress", onDelete: "CASCADE" });
UserModuleProgress.belongsTo(LearningModule, { foreignKey: "moduleId", as: "module", onDelete: "CASCADE" });

// 3.1 MODULE TRANSCRIPTS
LearningModule.hasOne(ModuleTranscript, { foreignKey: "moduleId", as: "transcript", onDelete: "CASCADE" });
ModuleTranscript.belongsTo(LearningModule, { foreignKey: "moduleId", as: "module", onDelete: "CASCADE" });

// 4. LEARNING PATHS
User.hasMany(LearningPath, { foreignKey: "userId", as: "learningPaths" });
LearningPath.belongsTo(User, { foreignKey: "userId", as: "user" });

LearningPath.belongsTo(UserPreferences, {
    foreignKey: "userPreferencesId",
    as: "userPreferences"
});
UserPreferences.hasMany(LearningPath, {
    foreignKey: "userPreferencesId",
    as: "learningPaths"
});

// LearningPath - LearningModule association
LearningPath.hasMany(LearningModule, { foreignKey: "learningPathId", as: "modules" });
LearningModule.belongsTo(LearningPath, { foreignKey: "learningPathId", as: "learningPath" });

// 5. ASSESSMENTS
User.hasMany(Assessment, { foreignKey: "userId", as: "assessments" });
Assessment.belongsTo(User, { foreignKey: "userId", as: "user" });

LearningModule.hasMany(Assessment, { foreignKey: "moduleId", as: "assessments", onDelete: "CASCADE" });
Assessment.belongsTo(LearningModule, { foreignKey: "moduleId", as: "module", onDelete: "CASCADE" });

// 6. CERTIFICATIONS (Catalog) - No direct user relation, mostly static

// 7. USER CERTIFICATIONS
User.hasMany(UserCertification, { foreignKey: "userId", as: "certifications" });
UserCertification.belongsTo(User, { foreignKey: "userId", as: "user" });

Certification.hasMany(UserCertification, { foreignKey: "certificationId", as: "userProgress" });
UserCertification.belongsTo(Certification, { foreignKey: "certificationId", as: "certification" });

// 8. USER PORTFOLIOS
User.hasOne(UserPortfolio, { foreignKey: "userId", as: "portfolio" });
UserPortfolio.belongsTo(User, { foreignKey: "userId", as: "user" });

// 9. LEARNING SCHEDULES
User.hasMany(LearningSchedule, { foreignKey: "userId", as: "schedules" });
LearningSchedule.belongsTo(User, { foreignKey: "userId", as: "user" });

LearningPath.hasMany(LearningSchedule, { foreignKey: "learningPathId", as: "schedules" });
LearningSchedule.belongsTo(LearningPath, { foreignKey: "learningPathId", as: "learningPath" });

// 10. AI ANALYSES
User.hasMany(AiAnalysis, { foreignKey: "userId", as: "aiAnalyses" });
AiAnalysis.belongsTo(User, { foreignKey: "userId", as: "user" });

// Existing Course - Branches relation
Course.hasMany(Branches, {
    foreignKey: "courseId",
    as: "branches",
    onDelete: "CASCADE"
});
Branches.belongsTo(Course, {
    foreignKey: "courseId",
    as: "course",
    onDelete: "CASCADE"
});

export {
    sequelize,
    User,
    Interest,
    Skill,
    Course,
    Branches,
    LearningPath,
    UserPreferences,
    LearningModule,
    UserModuleProgress,
    Assessment,
    Certification,
    UserCertification,
    UserPortfolio,
    LearningSchedule,
    AiAnalysis,
    EducationalResource,
    KidDrawingImage,
    ModuleTranscript,
    Op
};
