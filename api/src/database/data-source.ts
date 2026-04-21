import "reflect-metadata";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5436,
    username: "core",
    password: "core",
    database: "core",
    synchronize: true,
    entities: [],
});
