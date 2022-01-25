import { NextFunction, Request, Response } from "express";
import { Schema, ParamSchema, validationResult } from "express-validator";
import { helper } from ".";

const uuid: ParamSchema = {
    trim: true,
    isUUID: {
        bail: true,
        options: 4,
    },
};

const string: ParamSchema = {
    trim: true,
    isString: {
        bail: true,
    },
    notEmpty: true,
};

const int: ParamSchema = {
    isInt: {
        bail: true,
    },
};

const ipv4: ParamSchema = {
    trim: true,
    isIP: {
        bail: true,
        options: 4,
    },
};

export default {
    uuid,
    string,
    int,
    ipv4,
};

export const objectFromSchema = (schema: Schema, object: { [key: string]: any }) =>
    Object.fromEntries(Object.entries(schema).map(([key, val]) => [key, object[key]]));

export const rejectIfBadRequest = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        let error = errors.array({ onlyFirstError: true }).pop()!;

        return helper.badRequest(res, `${error.msg} ${error.param}`);
    }
    return next();
};
