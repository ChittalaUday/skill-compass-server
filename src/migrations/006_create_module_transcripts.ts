import sequelize from "../config/db.js";
import { QueryInterface, DataTypes } from "sequelize";

export async function up() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    console.log("Running migration: create module_transcripts table...");

    await queryInterface.createTable("module_transcripts", {
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
        transcriptChunks: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            allowNull: true
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
        }
    });

    // Add index for moduleId
    await queryInterface.addIndex("module_transcripts", ["moduleId"]);
    console.log("✅ Created module_transcripts table");
}

export async function down() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    await queryInterface.dropTable("module_transcripts");
    console.log("✅ Dropped module_transcripts table");
}
