import type { NextRequest } from "next/server";

import { postgresRepositoryLayer } from "../../../server/database/postgres-repository";
import { makeApiHandler } from "../../../server/http/api-handler";
import { databaseUrl } from "../../../server/runtime";

const api = makeApiHandler(postgresRepositoryLayer(databaseUrl));

const handle = (request: NextRequest) => api.handler(request);

export const DELETE = handle;
export const GET = handle;
export const PATCH = handle;
export const POST = handle;
