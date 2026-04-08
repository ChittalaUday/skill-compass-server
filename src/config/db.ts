import "dotenv/config";
import { Sequelize } from "sequelize";
import fs from "fs";

const isNeon =
    process.env.DB_TYPE === "neon" || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("neon.tech"));
const isAWS = process.env.DB_TYPE?.toUpperCase() === "AWS";

// Helper to get CA content for AWS RDS
const getCaContent = () => {
    const caPath = process.env.DB_CA_PATH || "./certs/global-bundle.pem";
    try {
        if (fs.existsSync(caPath)) {
            return fs.readFileSync(caPath).toString();
        }
    } catch (error) {
        console.warn(`⚠️ Warning: Could not read SSL CA file at ${caPath}`);
    }
    return undefined;
};

const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
    dialect: "postgres",
    logging: false,
    ...(isAWS
        ? {
              dialectOptions: {
                  ssl: {
                      require: true,
                      rejectUnauthorized: false,
                      ca: getCaContent()
                  }
              },
              pool: {
                  max: 10,
                  min: 2,
                  acquire: 30000,
                  idle: 10000
              }
          }
        : isNeon
          ? {
                dialectOptions: {
                    ssl: {
                        require: true,
                        rejectUnauthorized: false
                    },
                    connectionTimeout: 3000,
                    keepAlive: true,
                    statement_timeout: 5000,
                    idle_in_transaction_session_timeout: 10000
                },
                pool: {
                    max: 10,
                    min: 0,
                    acquire: 30000,
                    idle: 10000,
                    evict: 1000
                }
            }
          : {
                // Default local Postgres settings
                pool: {
                    max: 10,
                    min: 2,
                    acquire: 30000,
                    idle: 10000
                }
            })
});

export async function postgresConnection() {
    try {
        await sequelize.authenticate();
        console.log(`✅ ${isAWS ? "AWS RDS" : isNeon ? "Neon" : "PostgresSQL"} connection established`);
        await sequelize.sync(); // Sync models with database
        return sequelize;
    } catch (error) {
        console.error("❌ PostgresSQL Connection failed:", error);
        process.exit(1);
    }
}

export default sequelize;
