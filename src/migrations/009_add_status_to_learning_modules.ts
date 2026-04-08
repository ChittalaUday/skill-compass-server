import sequelize from "../config/db.js";
import { QueryInterface, DataTypes } from "sequelize";

export async function up() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    console.log("Running migration: add status column to learning_modules table...");

    // 1. Create the ENUM type if it doesn't exist
    await sequelize.query(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_learning_modules_status') THEN CREATE TYPE \"enum_learning_modules_status\" AS ENUM('enriching', 'completed', 'failed'); END IF; END $$;"
    );

    // 2. Add the column
    await queryInterface.addColumn("learning_modules", "status", {
        type: DataTypes.ENUM("enriching", "completed", "failed"),
        defaultValue: "enriching",
        allowNull: false
    });

    console.log("✅ Added status column to learning_modules");
}

export async function down() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    await queryInterface.removeColumn("learning_modules", "status");
    // Note: We don't drop the type in down to avoid breakage if other tables use it,
    // but in this case, it's specific to this table.
    console.log("✅ Removed status column from learning_modules");
}
