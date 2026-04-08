import sequelize from "../config/db.js";
import { QueryInterface, DataTypes } from "sequelize";

export async function up() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    console.log("Running migration: add status column to learning_modules table...");

    // 1. Create the ENUM type with standardized values
    await sequelize.query(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_learning_modules_status') THEN CREATE TYPE \"enum_learning_modules_status\" AS ENUM('pending', 'inprogress', 'completed', 'failed'); END IF; END $$;"
    );

    // Ensure all values exist if the type was created with different values previously
    await sequelize
        .query("ALTER TYPE \"enum_learning_modules_status\" ADD VALUE IF NOT EXISTS 'pending';")
        .catch(() => {});
    await sequelize
        .query("ALTER TYPE \"enum_learning_modules_status\" ADD VALUE IF NOT EXISTS 'inprogress';")
        .catch(() => {});
    await sequelize
        .query("ALTER TYPE \"enum_learning_modules_status\" ADD VALUE IF NOT EXISTS 'completed';")
        .catch(() => {});
    await sequelize
        .query("ALTER TYPE \"enum_learning_modules_status\" ADD VALUE IF NOT EXISTS 'failed';")
        .catch(() => {});

    // 2. Add the column with the new standardized default
    await queryInterface.addColumn("learning_modules", "status", {
        type: DataTypes.ENUM("pending", "inprogress", "completed", "failed"),
        defaultValue: "pending",
        allowNull: false
    });

    console.log("✅ Added standardized status column to learning_modules");
}

export async function down() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();
    await queryInterface.removeColumn("learning_modules", "status");
    // Note: We don't drop the type in down to avoid breakage if other tables use it,
    // but in this case, it's specific to this table.
    console.log("✅ Removed status column from learning_modules");
}
