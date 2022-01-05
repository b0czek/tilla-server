import { Connection, IDatabaseDriver, MikroORM } from "@mikro-orm/core";
import express, { Router, Request, Response, NextFunction } from "express";
import { deviceRouter } from "./device";
import { sensorRouter } from "./drivers/sensors";
import { queryParser } from "express-query-parser";
import { Device } from "../entities/Device";
import { Dispatcher } from "../dispatcher";

const error = (code: number, res: Response, message: string) => {
    return res.status(code).json({
        error: true,
        message,
    });
};
const badRequest = (res: Response, message = "invalid request") => error(400, res, message);

const verifyReq = (requiredFields: RequiredFields) => {
    return (req: Request, res: Response, next: NextFunction) => {
        let fields!: { [field: string]: any };
        if (req.method == "GET") {
            fields = req.query;
        } else if (req.method == "POST") {
            fields = req.body;
        } else {
            return badRequest(res);
        }
        if (!fields) {
            return badRequest(res);
        }

        for (const [field, type] of Object.entries(requiredFields)) {
            if (!(field in fields) || typeof fields[field] !== type) {
                return badRequest(res, `invalid field '${field}'`);
            }
        }
        return next();
    };
};
/**
 * function returning middleware that fetches device object (and places it in res.local.device) or returns 400 if not found
 * @param orm mikroorm object
 * @param filters filters used in where clause
 * @returns
 */
const getDevice = (orm: MikroORM<IDatabaseDriver<Connection>>, filters = ["device_uuid"]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        let where: { [field: string]: string } = {};
        for (let filter of filters) {
            let fields = req.method === "GET" ? req.query : req.body;
            if (!(filter in fields)) {
                return badRequest(res, `missing field '${filter}'`);
            }
            where[filter] = fields[filter];
        }
        try {
            res.locals.device = await orm.em.findOne(Device, where);
        } catch (err) {
            return error(500, res, "could not fetch database");
        }

        if (!res.locals.device) {
            return badRequest(res, "device not found");
        }

        return next();
    };
};

const _omitFields = <T extends Object, P extends Readonly<Array<keyof T>>>(obj: T, omittedFields: P) =>
    <Omit<T, typeof omittedFields[number]>>(
        Object.fromEntries(Object.entries(obj).filter(([key, _]) => !omittedFields.includes(<keyof T>key)))
    );
/**
 * function for removing object's props
 * @param subject object(s) to remove fields from
 * @param omittedFields array of keys to be removed, it's important to pass them as constant `["key1", "key2"] as const;`
 * @returns object(s), with keys removed
 */
const omitFields = <T extends Object, P extends Readonly<Array<keyof T>>>(subject: T | T[], omittedFields: P) =>
    Array.isArray(subject)
        ? subject.map((obj) => _omitFields(obj, omittedFields))
        : _omitFields(subject, omittedFields);

export const helper = {
    error,
    badRequest,
    verifyReq,
    getDevice,
    omitFields,
};

export const apiRouter = (orm: MikroORM<IDatabaseDriver<Connection>>, dispatcher: Dispatcher) => {
    const router = Router();
    router.use(
        queryParser({
            parseNull: true,
            parseUndefined: true,
            parseBoolean: true,
            parseNumber: true,
        }),
        express.json()
    );
    router.use("/device", deviceRouter(orm));
    router.use("/sensors", sensorRouter(orm, dispatcher));
    return router;
};

interface RequiredFields {
    [field: string]: string;
}
