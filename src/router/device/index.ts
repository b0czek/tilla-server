import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import { Router } from "express";
import { Dispatcher } from "../../dispatcher";
import { deviceEndpoints } from "./device";
import { registrationRouter } from "./registration";

export const deviceRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = Router();
    router.use("/registration", registrationRouter(orm, dispatcher));
    router.use("/", deviceEndpoints(orm));
    return router;
};
