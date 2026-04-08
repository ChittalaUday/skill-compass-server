import sequelize from "../config/db.js";
import { QueryInterface, DataTypes } from "sequelize";

export async function up() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    console.log("Running migration: add test fields to user_module_progress...");

    await queryInterface.addColumn("user_module_progress", "testCompleted", {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    });

    await queryInterface.addColumn("user_module_progress", "testResults", {
        type: DataTypes.JSONB,
        allowNull: true
    });

    console.log("✅ Added test fields to user_module_progress");
}

export async function down() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    await queryInterface.removeColumn("user_module_progress", "testCompleted");
    await queryInterface.removeColumn("user_module_progress", "testResults");
    console.log("✅ Removed test fields from user_module_progress");
}
