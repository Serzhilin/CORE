import "reflect-metadata";
import path from "path";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import { Person } from "./entities/Person";
import { Community } from "./entities/Community";
import { CommunityMembership } from "./entities/CommunityMembership";
import { AvailabilityType } from "./entities/AvailabilityType";
import { AvailabilityLog } from "./entities/AvailabilityLog";
import { Workgroup } from "./entities/Workgroup";
import { Role } from "./entities/Role";
import { WorkgroupMembership } from "./entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "./entities/WorkgroupMemberRole";
import { OrganizationMembershipType } from "./entities/OrganizationMembershipType";

config({ path: path.resolve(__dirname, "../../../.env") });

const isProduction = process.env.NODE_ENV === "production";

if (!isProduction) {
    console.warn("[DataSource] synchronize=true — schema auto-synced. Never point this at production data.");
}

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5436,
    username: process.env.DB_USER || "core",
    password: process.env.DB_PASSWORD || "core",
    database: process.env.DB_NAME || "core",
    synchronize: process.env.DB_SYNCHRONIZE === "true" ? true : !isProduction,
    entities: [
        Person, Community, CommunityMembership,
        AvailabilityType, AvailabilityLog,
        Workgroup, Role, WorkgroupMembership, WorkgroupMemberRole,
        OrganizationMembershipType,
    ],
    logging: false,
});
