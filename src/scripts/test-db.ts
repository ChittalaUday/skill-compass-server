import { Client } from "pg";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function main(): Promise<void> {
    const isAWS = process.env.DB_TYPE?.toUpperCase() === "AWS";

    if (!isAWS) {
        console.log("Skipping AWS DB test because DB_TYPE is not AWS");
        return;
    }

    // Parsing DATABASE_URL if present, otherwise using individual components
    const clientConfig: any = {
        connectionString: process.env.DATABASE_URL
    };

    if (isAWS) {
        const caPath = process.env.DB_CA_PATH || "./certs/global-bundle.pem";
        clientConfig.ssl = {
            rejectUnauthorized: false,
            ca: fs.existsSync(caPath) ? fs.readFileSync(caPath).toString() : undefined
        };
    }

    const client = new Client(clientConfig);

    try {
        await client.connect();
        const res = await client.query("SELECT version()");
        console.log("✅ Connection successful!");
        console.log("PostgreSQL Version:", res.rows[0].version);
    } catch (error) {
        console.error("❌ Database error:", error);
        throw error;
    } finally {
        await client.end();
    }
}

main().catch(console.error);
