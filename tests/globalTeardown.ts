import { main } from "../src/main";

export default async () => {
    let services: Awaited<ReturnType<typeof main>> = (global as any).__services__;

    services.dispatcher.close();
    await services.redisClient.disconnect();
    await services.orm.close();
    await services.server.close();
};
