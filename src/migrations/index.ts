import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { postgresConnection } from "../config/db.js";
import sequelize from "../config/db.js";
import { QueryTypes } from "sequelize";
import "../models/index.js"; // Ensure all models are registered and associations are set

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAllMigrations() {
    console.log("🚀 Starting migration runner...");

    try {
        await postgresConnection(); // Establish connection and sync models

        // Create migration history table if it doesn't exist
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS migrations_history (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Fetch already executed migrations
        const executedMigrationsResult = await sequelize.query("SELECT filename FROM migrations_history", {
            type: QueryTypes.SELECT
        });
        const executedFiles = new Set(executedMigrationsResult.map((m: any) => m.filename));

        // Get all files in the current directory
        const files = fs
            .readdirSync(__dirname)
            .filter(
                (file) =>
                    (file.endsWith(".ts") || file.endsWith(".js")) && file !== "index.ts" && !file.endsWith(".d.ts")
            )
            .sort(); // Ensure they run in order

        console.log(`Found ${files.length} migration files. ${executedFiles.size} already executed.`);

        for (const file of files) {
            if (executedFiles.has(file)) {
                // console.log(`⏩ Skipping already executed migration: ${file}`);
                continue;
            }

            console.log(`\n📦 Running migration: ${file}`);

            try {
                // Dynamically import the migration file
                const migrationPath = path.join(__dirname, file);
                const migration = await import(migrationPath);

                if (migration.up && typeof migration.up === "function") {
                    await migration.up();

                    // Record successful migration
                    await sequelize.query("INSERT INTO migrations_history (filename) VALUES (:file)", {
                        replacements: { file },
                        type: QueryTypes.INSERT
                    });

                    console.log(`✅ ${file} completed and recorded.`);
                } else {
                    console.warn(`⚠️  ${file} does not export an 'up' function. Skipping.`);
                }
            } catch (err: any) {
                // Special handling for legacy migrations that might have run before tracking
                const isAlreadyExists =
                    err.message.includes("already exists") || err.message.includes("already a member of");

                if (isAlreadyExists) {
                    // VERIFY IF THE RESOURCE TRULY EXISTS BEFORE MARKING AS DONE
                    console.log(`🔍 Verifying if resources from ${file} actually exist in the database...`);

                    let verified = false;

                    // 1. Check for table creation (e.g., ERR: relation "foo" already exists)
                    const tableMatch = err.message.match(/relation "([^"]+)" already exists/);
                    if (tableMatch) {
                        const tableName = tableMatch[1];
                        const tableExistsResult: any = await sequelize.query(
                            `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :tableName)`,
                            { replacements: { tableName }, type: QueryTypes.SELECT }
                        );
                        if (tableExistsResult[0].exists) {
                            console.log(`✅ Verified: Table "${tableName}" already exists.`);
                            verified = true;
                        }
                    }

                    // 2. Check for column addition (e.g., ERR: column "foo" of relation "bar" already exists)
                    const columnMatch = err.message.match(/column "([^"]+)" of relation "([^"]+)" already exists/);
                    if (columnMatch) {
                        const columnName = columnMatch[1];
                        const tableName = columnMatch[2];
                        const columnExistsResult: any = await sequelize.query(
                            `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = :tableName AND column_name = :columnName)`,
                            { replacements: { tableName, columnName }, type: QueryTypes.SELECT }
                        );
                        if (columnExistsResult[0].exists) {
                            console.log(`✅ Verified: Column "${columnName}" already exists in table "${tableName}".`);
                            verified = true;
                        }
                    }

                    // 3. Check for index creation (relies on PostgreSQL common error messages)
                    const indexMatch = err.message.match(/relation "([^"]+)" already exists/i);
                    // Often index errors look just like table errors in Postgres "relation 'idx_name' already exists"
                    if (!verified && indexMatch) {
                        const indexName = indexMatch[1];
                        const indexExistsResult: any = await sequelize.query(
                            `SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = :indexName)`,
                            { replacements: { indexName }, type: QueryTypes.SELECT }
                        );
                        if (indexExistsResult[0].exists) {
                            console.log(`✅ Verified: Index "${indexName}" already exists.`);
                            verified = true;
                        }
                    }

                    if (verified) {
                        // Record it as executed since we verified the end state
                        await sequelize.query("INSERT INTO migrations_history (filename) VALUES (:file)", {
                            replacements: { file },
                            type: QueryTypes.INSERT
                        });
                        console.log(`📦 Migration ${file} marked as executed in history after verification.`);
                        continue;
                    }

                    // If we couldn't verify but still got an "already exists" error,
                    // something is weird, so we should probably stop.
                    console.error(
                        `❌ Could not verify existing resources for ${file} despite error. Error:`,
                        err.message
                    );
                    throw err;
                }

                console.error(`❌ Error in ${file}:`, err.message);
                // Decide if we should stop or continue. Usually migrations should stop on error.
                throw err;
            }
        }

        console.log("\n🎉 All migrations up to date!");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Migration runner failed:", error);
        process.exit(1);
    }
}

runAllMigrations();
