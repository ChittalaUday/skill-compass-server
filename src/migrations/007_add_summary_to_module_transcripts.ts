import sequelize from "../config/db.js";
import { QueryInterface, DataTypes } from "sequelize";

export async function up() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    console.log("Running migration: add summary to module_transcripts table...");

    await queryInterface.addColumn("module_transcripts", "summary", {
        type: DataTypes.TEXT,
        allowNull: true
    });

    console.log("✅ Added summary column to module_transcripts");
}

export async function down() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    await queryInterface.removeColumn("module_transcripts", "summary");
    console.log("✅ Removed summary column from module_transcripts");
}
