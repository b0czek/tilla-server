import type { InitialOptionsTsJest } from "ts-jest";
import { defaults as tsjPreset } from "ts-jest/presets";

const config: InitialOptionsTsJest = {
    globalSetup: "<rootDir>/tests/globalSetup.ts",
    globalTeardown: "<rootDir>/tests/globalTeardown.ts",
    globals: {
        "ts-jest": {
            tsconfig: "tsconfig.json",
        },
        // port for express to open on, must be free
        deviceIp: "192.168.1.17",
    },
    transform: {
        ...tsjPreset.transform,
    },
};

export default config;
