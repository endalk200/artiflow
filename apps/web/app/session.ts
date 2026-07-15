import { auth } from "@app/auth/server";
import { headers } from "next/headers";

export async function getServerSession() {
	return auth.api.getSession({
		headers: await headers(),
	});
}
