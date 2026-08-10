import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { ARTIFLOW_CLI_CLIENT_ID, auth } from "./auth";

const databaseURL = process.env.DATABASE_TEST_URL;
if (databaseURL === undefined) {
	throw new Error(
		"DATABASE_TEST_URL is required for the Better Auth integration test.",
	);
}

const pool = new Pool({ connectionString: databaseURL });
const unique = crypto.randomUUID();
const ownerId = `auth_owner_${unique}`;
const attackerId = `auth_attacker_${unique}`;
const ownerToken = `owner_session_${unique}`;
const attackerToken = `attacker_session_${unique}`;

function bearer(token: string) {
	return { authorization: `Bearer ${token}` };
}

async function authRequest<T>(
	path: string,
	init?: RequestInit,
): Promise<{ readonly body: T; readonly response: Response }> {
	const headers = new Headers(init?.headers);
	if (init?.body !== undefined) headers.set("content-type", "application/json");
	const response = await auth.handler(
		new Request(`http://localhost:3000/api/auth${path}`, {
			...init,
			headers,
		}),
	);
	return { body: (await response.json()) as T, response };
}

beforeAll(async () => {
	for (const [id, name, token] of [
		[ownerId, "Auth owner", ownerToken],
		[attackerId, "Auth attacker", attackerToken],
	] as const) {
		await pool.query(
			'insert into "user" (id, name, email, email_verified, created_at, updated_at) values ($1, $2, $3, true, now(), now())',
			[id, name, `${id}@example.com`],
		);
		await pool.query(
			"insert into \"session\" (id, token, user_id, expires_at, created_at, updated_at) values ($1, $2, $3, now() + interval '1 hour', now(), now())",
			[`session_${id}`, token, id],
		);
	}
});

afterAll(async () => {
	await pool.query('delete from "device_code" where user_id = any($1)', [
		[ownerId, attackerId],
	]);
	await pool.query('delete from "user" where id = any($1)', [
		[ownerId, attackerId],
	]);
	await pool.end();
});

describe("Better Auth device authorization", () => {
	it("claims for one user, rejects another, and issues a single-use bearer session", async () => {
		const issued = await authRequest<{
			readonly device_code: string;
			readonly user_code: string;
		}>("/device/code", {
			body: JSON.stringify({ client_id: ARTIFLOW_CLI_CLIENT_ID }),
			method: "POST",
		});
		expect(issued.response.status).toBe(200);

		const claimed = await authRequest(
			`/device?user_code=${encodeURIComponent(issued.body.user_code)}`,
			{ headers: bearer(ownerToken), method: "GET" },
		);
		expect(claimed.response.status).toBe(200);

		const attackerApproval = await authRequest<{ readonly error: string }>(
			"/device/approve",
			{
				body: JSON.stringify({ userCode: issued.body.user_code }),
				headers: bearer(attackerToken),
				method: "POST",
			},
		);
		expect(attackerApproval.response.status).toBe(403);
		expect(attackerApproval.body.error).toBe("access_denied");

		const approval = await authRequest<{ readonly success: boolean }>(
			"/device/approve",
			{
				body: JSON.stringify({ userCode: issued.body.user_code }),
				headers: bearer(ownerToken),
				method: "POST",
			},
		);
		expect(approval.response.status).toBe(200);
		expect(approval.body.success).toBe(true);

		const poll = () =>
			authRequest<{
				readonly access_token?: string;
				readonly error?: string;
				readonly token_type?: string;
			}>("/device/token", {
				body: JSON.stringify({
					client_id: ARTIFLOW_CLI_CLIENT_ID,
					device_code: issued.body.device_code,
					grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				}),
				method: "POST",
			});
		const token = await poll();
		expect(token.response.status).toBe(200);
		expect(token.body.token_type).toBe("Bearer");
		expect(token.body.access_token).toBeTypeOf("string");

		const session = await authRequest<{
			readonly user?: { readonly id: string };
		}>("/get-session", {
			headers: bearer(token.body.access_token as string),
			method: "GET",
		});
		expect(session.response.status).toBe(200);
		expect(session.body.user?.id).toBe(ownerId);

		const replay = await poll();
		expect(replay.response.status).toBe(400);
		expect(replay.body.error).toBe("invalid_grant");
	});

	it("rejects clients other than the Artiflow CLI", async () => {
		const response = await authRequest<{ readonly error: string }>(
			"/device/code",
			{
				body: JSON.stringify({ client_id: "untrusted-client" }),
				method: "POST",
			},
		);
		expect(response.response.status).toBe(400);
		expect(response.body.error).toBe("invalid_client");
	});

	it("offers GitHub social sign-in while email and password stays disabled", async () => {
		const github = await authRequest<{
			readonly redirect: boolean;
			readonly url: string;
		}>("/sign-in/social", {
			body: JSON.stringify({ callbackURL: "/projects", provider: "github" }),
			method: "POST",
		});
		expect(github.response.status).toBe(200);
		expect(github.body.redirect).toBe(true);
		const authorizationURL = new URL(github.body.url);
		expect(authorizationURL.origin).toBe("https://github.com");
		expect(authorizationURL.pathname).toBe("/login/oauth/authorize");
		expect(authorizationURL.searchParams.get("client_id")).toBe(
			process.env.GITHUB_CLIENT_ID,
		);
		expect(authorizationURL.searchParams.get("redirect_uri")).toBe(
			"http://localhost:3000/api/auth/callback/github",
		);

		const email = await authRequest<{ readonly code: string }>(
			"/sign-in/email",
			{
				body: JSON.stringify({
					email: "user@example.com",
					password: "not-used",
				}),
				method: "POST",
			},
		);
		expect(email.response.status).toBe(400);
		expect(email.body.code).toBe("EMAIL_PASSWORD_DISABLED");
	});
});
