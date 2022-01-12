import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import { Router } from "express";
import { Dispatcher } from "../../dispatcher";
import { displayRouter } from "./display";

// endpoints used for queries made from esp device
export const nodeRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = Router();

    router.use("/display", displayRouter(orm, dispatcher));

    return router;
};
