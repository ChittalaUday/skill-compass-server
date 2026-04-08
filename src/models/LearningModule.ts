import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

class LearningModule extends Model {
    declare id: number;
    declare title: string;
    declare description: string | null;
    declare moduleType: "course" | "micro-lesson" | "project" | "assessment" | "certification" | "workshop" | "reading";
    declare format: "video" | "article" | "interactive" | "live-session" | "project" | "quiz" | "podcast" | null;
    declare difficulty: "beginner" | "intermediate" | "advanced" | "expert";
    declare duration: number | null; // in minutes
    declare contentUrl: string | null;
    declare thumbnailUrl: string | null;
    declare category: string | null;
    declare subcategory: string | null;
    declare skillTags: string[];
    declare prerequisiteModules: number[];
    declare targetUserGroups: string[];
    declare averageRating: number;
    declare completionCount: number;
    declare groupSpecificMetadata: any; // JSONB
    declare courseId: number | null;
    declare learningPathId: number | null; // New: link to learning path
    declare orderInPath: number | null; // New: sequence in path
    declare isAiGenerated: boolean;
    declare status: "pending" | "inprogress" | "completed" | "failed"; // Standardized status
    declare generationMetadata: any;
}

LearningModule.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        moduleType: {
            type: DataTypes.ENUM(
                "course",
                "micro-lesson",
                "project",
                "assessment",
                "certification",
                "workshop",
                "reading"
            ),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM("pending", "inprogress", "completed", "failed"),
            defaultValue: "pending",
            allowNull: false
        },
        format: {
            type: DataTypes.ENUM("video", "article", "interactive", "live-session", "project", "quiz", "podcast"),
            allowNull: true
        },
        difficulty: {
            type: DataTypes.ENUM("beginner", "intermediate", "advanced", "expert"),
            defaultValue: "intermediate"
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 5,
                max: 10000
            }
        },
        contentUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        thumbnailUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true
        },
        subcategory: {
            type: DataTypes.STRING,
            allowNull: true
        },
        skillTags: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: []
        },
        prerequisiteModules: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            defaultValue: []
        },
        targetUserGroups: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: ["COLLEGE_STUDENTS", "PROFESSIONALS"]
        },
        averageRating: {
            type: DataTypes.DECIMAL(3, 2),
            defaultValue: 0.0,
            validate: {
                min: 0,
                max: 5
            }
        },
        completionCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        groupSpecificMetadata: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        courseId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "courses",
                key: "id"
            }
        },
        learningPathId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "learning_paths",
                key: "id"
            }
        },
        orderInPath: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        isAiGenerated: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        generationMetadata: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    },
    {
        sequelize,
        tableName: "learning_modules",
        timestamps: true
    }
);

export default LearningModule;
