import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import { Router } from "express";
import { Dispatcher } from "../../dispatcher";
import { deviceEndpoints } from "./device";
import { registrationRouter } from "./registration";
import { RegistrationProps } from "../../api";
import { isIPv4 } from "net";

export const areRegistrationPropsValid = (props: RegistrationProps): string | true => {
    if (!isIPv4(props.ip)) {
        return "invalid ip address";
    }
    if (props.name.length < 3) {
        return "device name too short";
    }
    return true;
};

export const deviceRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = Router();
    router.use("/registration", registrationRouter(orm, dispatcher));
    router.use("/", deviceEndpoints(orm, dispatcher));
    return router;
};
