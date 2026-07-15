import { authRouteHandlers } from "@app/auth/server";

export const runtime = "nodejs";

export const { DELETE, GET, PATCH, POST, PUT } = authRouteHandlers;
