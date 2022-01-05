import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import { Router } from "express";
import { deviceEndpoints } from "./device";
import { registrationRouter } from "./registration";

export const deviceRouter = (orm: MikroORM<IDatabaseDriver<Connection>>) => {
    const router = Router();
    router.use("/registration", registrationRouter(orm));
    router.use("/", deviceEndpoints(orm));
    return router;
};
