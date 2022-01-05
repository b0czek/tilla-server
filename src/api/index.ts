import fetch from "node-fetch";

export interface QueryParams {
    ip: string;
    auth_key?: string;
    body?: string | object;
}

export interface QueryParamsAuth extends QueryParams {
    auth_key: string;
}
export abstract class QueryApi {
    protected static method: string = "GET";
    protected static uri: string;
    protected static apiVersion: number = 1;
    public static async _fetch<R, P extends QueryParams>(params: P): Promise<R> {
        return new Promise(async (resolve, reject) => {
            let parameters = params.auth_key
                ? new URLSearchParams({
                      auth_key: params.auth_key,
                  })
                : "";
            const url = `http://${params.ip}/api/v${this.apiVersion}${
                this.uri.startsWith("/") ? this.uri : `/${this.uri}`
            }?${parameters}`;
            if (process.env.NODE_ENV !== "production") {
                console.log(`${url}`);
            }
            try {
                let req = await fetch(url, {
                    method: this.method,
                    body: typeof params.body === "string" ? params.body : JSON.stringify(params.body),
                });
                if (Math.floor(req.status / 100) != 2) {
                    reject(await req.text());
                }
                resolve(await req.json());
            } catch (err) {
                reject(err.message);
            }
        });
    }
}

export * from "./device";
export * from "./registration";
export * from "./sensors/index";
