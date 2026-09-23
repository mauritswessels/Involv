import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../lib/logger";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `No API route matches ${req.method} ${req.path}.`,
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const candidate = err as {
    message?: string;
    name?: string;
    stack?: string;
    status?: number;
    statusCode?: number;
    type?: string;
  };
  const reportedStatus = candidate.status ?? candidate.statusCode ?? 500;
  const status =
    Number.isInteger(reportedStatus) &&
    reportedStatus >= 400 &&
    reportedStatus < 500
      ? reportedStatus
      : 500;

  const logPayload = {
    error: {
      message: candidate.message ?? "Unknown error",
      name: candidate.name ?? "Error",
      stack: status >= 500 ? candidate.stack : undefined,
      type: candidate.type,
    },
    method: req.method,
    path: req.path,
    requestId: req.id,
    status,
  };

  const logMessage =
    status >= 500 ? "Unhandled API request error" : "Rejected API request";
  const log = status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log(
    logPayload,
    logMessage,
  );

  const message =
    status === 413
      ? "The request body is too large."
      : status === 400
        ? "The request body is invalid."
        : "The request could not be completed.";

  res.status(status).json({
    error: status >= 500 ? "Internal server error" : "Invalid request",
    message,
    requestId: req.id,
  });
};