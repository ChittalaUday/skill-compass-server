import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

class ModuleTranscript extends Model {
    declare id: number;
    declare moduleId: number;
    declare transcript: string;
    declare summary: string | null;
    declare transcriptChunks: string[] | null;
    declare createdAt: Date;
    declare updatedAt: Date;
}

ModuleTranscript.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        moduleId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "learning_modules",
                key: "id"
            },
            onDelete: "CASCADE"
        },
        transcript: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        summary: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        transcriptChunks: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            allowNull: true
        }
    },
    {
        sequelize,
        tableName: "module_transcripts",
        timestamps: true
    }
);

export default ModuleTranscript;
