import { main } from "../src/main";
// const main = require("../src/main");
export default async () => {
    (global as any).__services__ = await main(3050);
};
