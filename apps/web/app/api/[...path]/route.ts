import type { NextRequest } from "next/server";

import { postgresRepositoryLayer } from "../../../server/database/postgres-repository";
import { getServerSession } from "../../../server/auth/session";
import { makeApiHandler } from "../../../server/http/api-handler";
import { databaseUrl } from "../../../server/runtime";

const api = makeApiHandler(postgresRepositoryLayer(databaseUrl));

const handle = async (request: NextRequest) => {
	const authorization = request.headers.get("authorization");
	if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
		return Response.json(
			{ _tag: "Unauthorized", message: "Bearer authentication is required." },
			{
				headers: { "www-authenticate": "Bearer" },
				status: 401,
			},
		);
	}
	const session = await getServerSession(request.headers);
	if (session === null) {
		return Response.json(
			{ _tag: "Unauthorized", message: "Authentication is required." },
			{
				headers: { "www-authenticate": "Bearer" },
				status: 401,
			},
		);
	}

	return api.handler(request, session.user.id);
};

export const DELETE = handle;
export const GET = handle;
export const PATCH = handle;
export const POST = handle;
