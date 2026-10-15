import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../lib/logger";
import { requestFailureMetadata } from "../lib/requestLogging";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "No API route matches this request.",
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const { status, category } = requestFailureMetadata(err);
  const logPayload = {
    category,
    method: req.method,
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
  if (res.headersSent) {
    // Express's final handler may log the forwarded exception. Never forward
    // the original message/stack after a partially written response.
    const safeError = new Error("Request failed after the response started.");
    safeError.stack = undefined;
    next(safeError);
    return;
  }

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