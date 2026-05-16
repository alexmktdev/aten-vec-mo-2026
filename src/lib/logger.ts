import pino from "pino";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
});

export default logger;

/**
 * Create a child logger for a specific route/context
 */
export function createRouteLogger(route: string, userId?: string) {
  return logger.child({
    route,
    ...(userId && { userId }),
  });
}
