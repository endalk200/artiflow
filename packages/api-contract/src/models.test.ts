import { assert, describe, it } from "@effect/vitest";
import { Schema } from "effect";

import {
	AppendRevisionPayload,
	Artifact,
	CreateArtifactPayload,
	CreateProjectPayload,
	InvalidRequest,
	Project,
	PublishResult,
} from "./models";

describe("Artiflow API wire models", () => {
	it("keeps malformed request errors stable on the wire", () => {
		const error = {
			_tag: "InvalidRequest" as const,
			location: "payload" as const,
			message: "Request payload does not match the API contract.",
		};

		assert.deepStrictEqual(
			Schema.decodeUnknownSync(InvalidRequest)(error),
			new InvalidRequest(error),
		);
	});

	it("decodes requested source formats so the API can reject unsupported values", () => {
		const payload = {
			idempotencyKey: "idem_create_artifact",
			source: "---\ntitle: Plan\n---\n\n# Plan",
			sourceFormatVersion: 1 as const,
		};

		assert.deepStrictEqual(
			Schema.decodeUnknownSync(CreateArtifactPayload)(payload),
			payload,
		);
		assert.deepStrictEqual(
			Schema.decodeUnknownSync(CreateArtifactPayload)({
				...payload,
				sourceFormatVersion: 2,
			}),
			{ ...payload, sourceFormatVersion: 2 },
		);
	});

	it("decodes the Project creation request and response wire shapes", () => {
		assert.deepStrictEqual(
			Schema.decodeUnknownSync(CreateProjectPayload)({
				idempotencyKey: "idem_create_project",
				name: "Artiflow",
			}),
			{
				idempotencyKey: "idem_create_project",
				name: "Artiflow",
			},
		);

		assert.deepStrictEqual(
			Schema.decodeUnknownSync(Project)({
				createdAt: "2026-07-16T12:00:00.000Z",
				id: "prj_123",
				name: "Artiflow",
				updatedAt: "2026-07-16T12:00:00.000Z",
			}),
			new Project({
				createdAt: "2026-07-16T12:00:00.000Z",
				id: "prj_123",
				name: "Artiflow",
				updatedAt: "2026-07-16T12:00:00.000Z",
			}),
		);
	});

	it("keeps Artifact source private while exposing immutable Revision metadata", () => {
		const revision = {
			artifactId: "art_123",
			createdAt: "2026-07-16T12:00:00.000Z",
			description: "A visual plan",
			id: "rev_123",
			number: 1,
			sourceFormatVersion: 1 as const,
			title: "Implementation plan",
		};
		const artifact = {
			createdAt: revision.createdAt,
			currentRevisionId: revision.id,
			description: revision.description,
			id: revision.artifactId,
			projectId: "prj_123",
			revisionCount: 1,
			revisions: [revision],
			title: revision.title,
			updatedAt: revision.createdAt,
		};

		assert.deepStrictEqual(
			Schema.decodeUnknownSync(Artifact)(artifact),
			new Artifact(artifact),
		);
		assert.notProperty(
			Schema.decodeUnknownSync(Artifact)({ ...artifact, source: "secret" }),
			"source",
		);
		assert.deepStrictEqual(
			Schema.decodeUnknownSync(AppendRevisionPayload)({
				expectedCurrentRevisionId: "rev_123",
				idempotencyKey: "idem_revision_2",
				source: "---\ntitle: Updated\n---\n",
				sourceFormatVersion: 1,
			}),
			{
				expectedCurrentRevisionId: "rev_123",
				idempotencyKey: "idem_revision_2",
				source: "---\ntitle: Updated\n---\n",
				sourceFormatVersion: 1,
			},
		);
		assert.deepStrictEqual(
			Schema.decodeUnknownSync(PublishResult)({
				artifactId: "art_123",
				projectId: "prj_123",
				revisionId: "rev_123",
				revisionNumber: 1,
				url: "http://localhost:3000/artifacts/art_123",
			}),
			{
				artifactId: "art_123",
				projectId: "prj_123",
				revisionId: "rev_123",
				revisionNumber: 1,
				url: "http://localhost:3000/artifacts/art_123",
			},
		);
	});
});
