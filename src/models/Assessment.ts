import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

class Assessment extends Model {
    declare id: number;
    declare userId: number;
    declare moduleId: number | null;
    declare assessmentType: "quiz" | "exam" | "project" | "assignment" | "presentation" | "case-study" | "peer-review";
    declare title: string;
    declare description: string | null;
    declare instructions: string | null;
    declare requiredDeliverables: string[];
    declare submissionData: any; // JSONB
    declare status: "pending" | "inprogress" | "submitted" | "under-review" | "graded" | "revision-needed";
    declare score: number | null;
    declare maxScore: number;
    declare grade: string | null;
    declare feedback: string | null;
    declare strengths: string[];
    declare improvements: string[];
    declare assessmentData: any; // JSONB
    declare startedAt: Date | null;
    declare submittedAt: Date | null;
    declare gradedAt: Date | null;
}

Assessment.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "users",
                key: "id"
            }
        },
        moduleId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "learning_modules",
                key: "id"
            }
        },
        assessmentType: {
            type: DataTypes.ENUM("quiz", "exam", "project", "assignment", "presentation", "case-study", "peer-review"),
            allowNull: false
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        instructions: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        requiredDeliverables: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: []
        },
        submissionData: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        status: {
            type: DataTypes.ENUM("pending", "inprogress", "submitted", "under-review", "graded", "revision-needed"),
            defaultValue: "pending"
        },
        score: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        maxScore: {
            type: DataTypes.INTEGER,
            defaultValue: 100
        },
        grade: {
            type: DataTypes.STRING(10),
            allowNull: true
        },
        feedback: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        strengths: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            defaultValue: []
        },
        improvements: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            defaultValue: []
        },
        assessmentData: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        startedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        submittedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        gradedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    },
    {
        sequelize,
        tableName: "assessments",
        timestamps: true
    }
);

export default Assessment;
