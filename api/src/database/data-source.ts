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
import { CoreSubscriber } from "../web3adapter/subscriber";

config({ path: path.resolve(__dirname, "../../../.env") });

const isProduction = process.env.NODE_ENV === "production";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5436"),
    username: process.env.DB_USER || "core",
    password: process.env.DB_PASSWORD || "core",
    database: process.env.DB_NAME || "core",
    synchronize: !isProduction,
    entities: [
        Person, Community, CommunityMembership,
        AvailabilityType, AvailabilityLog,
        Workgroup, Role, WorkgroupMembership, WorkgroupMemberRole,
    ],
    subscribers: [CoreSubscriber],
    logging: false,
});
