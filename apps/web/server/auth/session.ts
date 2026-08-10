import { headers } from "next/headers";

import { auth } from "./auth";

export async function getServerSession(requestHeaders?: Headers) {
	return auth.api.getSession({
		headers: requestHeaders ?? (await headers()),
	});
}
