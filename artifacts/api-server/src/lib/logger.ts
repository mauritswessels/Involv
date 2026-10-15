import pino from "pino";
import { requestLogSerializers } from "./requestLogging";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  serializers: { err: requestLogSerializers.err },
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
