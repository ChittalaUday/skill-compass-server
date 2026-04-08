import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

class UserModuleProgress extends Model {
    declare id: number;
    declare userId: number;
    declare moduleId: number;
    declare status: "pending" | "inprogress" | "completed" | "failed";
    declare timeSpent: number | null; // Minutes
    declare progressPercentage: number;
    declare completedAt: Date | null;
    declare score: number | null;
    declare maxScore: number | null;
    declare passed: boolean | null;
    declare rating: number | null;
    declare feedback: string | null;
    declare testCompleted: boolean;
    declare testResults: any; // JSONB
    declare progressData: any; // JSONB
}

UserModuleProgress.init(
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
            allowNull: false,
            references: {
                model: "learning_modules",
                key: "id"
            }
        },
        status: {
            type: DataTypes.ENUM("pending", "inprogress", "completed", "failed"),
            defaultValue: "pending"
        },
        timeSpent: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        progressPercentage: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 100
            }
        },
        completedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        score: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        maxScore: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passed: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1,
                max: 5
            }
        },
        feedback: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        testCompleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        testResults: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        progressData: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    },
    {
        sequelize,
        tableName: "user_module_progress",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ["userId", "moduleId"]
            }
        ]
    }
);

export default UserModuleProgress;
