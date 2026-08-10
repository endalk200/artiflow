import {
	Artifact,
	ArtifactSummary,
	InfrastructureError,
	Project,
	Revision,
} from "@app/api-contract/models";
import * as PgClient from "@effect/sql-pg/PgClient";
import { and, desc, eq, sql } from "drizzle-orm";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Effect, Layer, Option, Redacted } from "effect";

import {
	ArtiflowRepository,
	type AppendRevisionResult,
	type ArtiflowRepositoryShape,
	type CreateArtifactResult,
	type CreateProjectResult,
	type StoredRevision,
} from "../artiflow/repository";
import { artifactsTable, projectsTable, revisionsTable } from "./schema";

const infrastructureError = (cause: unknown) =>
	new InfrastructureError({
		message:
			cause instanceof Error ? cause.message : "PostgreSQL operation failed.",
	});

const asProject = (row: typeof projectsTable.$inferSelect) =>
	new Project({
		createdAt: row.createdAt,
		id: row.id,
		name: row.name,
		updatedAt: row.updatedAt,
	});

const asRevision = (row: typeof revisionsTable.$inferSelect): Revision =>
	new Revision({
		artifactId: row.artifactId,
		createdAt: row.createdAt,
		...(row.description === null ? {} : { description: row.description }),
		id: row.id,
		number: row.number,
		sourceFormatVersion: 1,
		title: row.title,
	});

const asStoredRevision = (
	row: typeof revisionsTable.$inferSelect,
): StoredRevision => Object.assign(asRevision(row), { source: row.source });

const scopedIdempotencyKey = (ownerUserId: string, idempotencyKey: string) =>
	JSON.stringify([ownerUserId, idempotencyKey]);

export const postgresRepositoryLayer = (databaseUrl: string) => {
	const PgLive = PgClient.layer({ url: Redacted.make(databaseUrl) });
	const RepositoryLive = Layer.effect(
		ArtiflowRepository,
		Effect.gen(function* () {
			const db = yield* PgDrizzle.makeWithDefaults();

			const readArtifact = (artifactId: string, ownerUserId?: string) =>
				Effect.gen(function* () {
					const records =
						ownerUserId === undefined
							? yield* db
									.select({ artifact: artifactsTable })
									.from(artifactsTable)
									.where(eq(artifactsTable.id, artifactId))
									.limit(1)
							: yield* db
									.select({ artifact: artifactsTable })
									.from(artifactsTable)
									.innerJoin(
										projectsTable,
										eq(projectsTable.id, artifactsTable.projectId),
									)
									.where(
										and(
											eq(artifactsTable.id, artifactId),
											eq(projectsTable.ownerUserId, ownerUserId),
										),
									)
									.limit(1);
					const record = records[0]?.artifact;
					if (record === undefined) return Option.none<Artifact>();
					const history = yield* db
						.select()
						.from(revisionsTable)
						.where(eq(revisionsTable.artifactId, artifactId))
						.orderBy(desc(revisionsTable.number));
					const current = history.find(
						(revision) => revision.number === record.currentRevisionNumber,
					);
					if (current === undefined) {
						return yield* Effect.fail(
							new Error(`Artifact ${artifactId} has no current Revision.`),
						);
					}
					return Option.some(
						new Artifact({
							createdAt: record.createdAt,
							currentRevisionId: current.id,
							...(current.description === null
								? {}
								: { description: current.description }),
							id: record.id,
							projectId: record.projectId,
							revisionCount: history.length,
							revisions: history.map(asRevision),
							title: current.title,
							updatedAt: record.updatedAt,
						}),
					);
				});

			const readRevision = (
				artifactId: string,
				revisionNumber?: number,
				ownerUserId?: string,
			) =>
				Effect.gen(function* () {
					const artifact = yield* readArtifact(artifactId, ownerUserId);
					if (Option.isNone(artifact)) return Option.none<StoredRevision>();
					const targetRevisionNumber =
						revisionNumber ??
						artifact.value.revisions.find(
							(revision) => revision.id === artifact.value.currentRevisionId,
						)?.number;
					if (targetRevisionNumber === undefined)
						return Option.none<StoredRevision>();
					const rows = yield* db
						.select()
						.from(revisionsTable)
						.where(
							and(
								eq(revisionsTable.artifactId, artifactId),
								eq(revisionsTable.number, targetRevisionNumber),
							),
						)
						.limit(1);
					return Option.fromNullishOr(rows[0]).pipe(
						Option.map(asStoredRevision),
					);
				});

			const repository: ArtiflowRepositoryShape = {
				appendRevision: (input) =>
					db
						.transaction((tx) =>
							Effect.gen(function* () {
								const idempotencyKey = scopedIdempotencyKey(
									input.ownerUserId,
									input.idempotencyKey,
								);
								yield* tx.execute(
									sql`select pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`,
								);
								const artifactRows = yield* tx
									.select({ artifact: artifactsTable })
									.from(artifactsTable)
									.innerJoin(
										projectsTable,
										eq(projectsTable.id, artifactsTable.projectId),
									)
									.where(
										and(
											eq(artifactsTable.id, input.artifactId),
											eq(projectsTable.ownerUserId, input.ownerUserId),
										),
									)
									.limit(1);
								const artifact = artifactRows[0]?.artifact;
								if (artifact === undefined)
									return { _tag: "artifactNotFound" } as const;
								const replayRows = yield* tx
									.select()
									.from(revisionsTable)
									.where(
										eq(
											revisionsTable.publicationIdempotencyKey,
											idempotencyKey,
										),
									)
									.limit(1);
								const replay = replayRows[0];
								if (replay !== undefined) {
									return replay.publicationRequestHash === input.requestHash &&
										replay.artifactId === input.artifactId &&
										artifact.id === replay.artifactId
										? ({
												_tag: "replayed",
												publication: {
													artifactId: replay.artifactId,
													projectId: artifact.projectId,
													revisionId: replay.id,
													revisionNumber: replay.number,
												},
											} satisfies AppendRevisionResult)
										: ({
												_tag: "idempotencyConflict",
											} satisfies AppendRevisionResult);
								}

								const currentRows = yield* tx
									.select({ id: revisionsTable.id })
									.from(revisionsTable)
									.where(
										and(
											eq(revisionsTable.artifactId, input.artifactId),
											eq(revisionsTable.number, artifact.currentRevisionNumber),
										),
									)
									.limit(1);
								const currentRevisionId = currentRows[0]?.id;
								if (currentRevisionId === undefined) {
									return yield* Effect.fail(
										new Error("Current Revision is missing."),
									);
								}
								if (currentRevisionId !== input.expectedCurrentRevisionId) {
									return { _tag: "conflict", currentRevisionId } as const;
								}
								const revisionNumber = artifact.currentRevisionNumber + 1;
								const updated = yield* tx
									.update(artifactsTable)
									.set({
										currentRevisionNumber: revisionNumber,
										updatedAt: input.now,
									})
									.where(
										and(
											eq(artifactsTable.id, input.artifactId),
											eq(
												artifactsTable.currentRevisionNumber,
												artifact.currentRevisionNumber,
											),
										),
									)
									.returning({ id: artifactsTable.id });
								if (updated.length === 0) {
									const latest = yield* tx
										.select({ id: revisionsTable.id })
										.from(revisionsTable)
										.innerJoin(
											artifactsTable,
											and(
												eq(artifactsTable.id, revisionsTable.artifactId),
												eq(
													artifactsTable.currentRevisionNumber,
													revisionsTable.number,
												),
											),
										)
										.where(eq(artifactsTable.id, input.artifactId))
										.limit(1);
									return {
										_tag: "conflict",
										currentRevisionId: latest[0]?.id ?? currentRevisionId,
									} as const;
								}
								yield* tx.insert(revisionsTable).values({
									artifactId: input.artifactId,
									createdAt: input.now,
									description: input.description,
									id: input.revisionId,
									number: revisionNumber,
									publicationIdempotencyKey: idempotencyKey,
									publicationRequestHash: input.requestHash,
									source: input.source,
									sourceFormatVersion: input.sourceFormatVersion,
									title: input.title,
								});
								return {
									_tag: "created",
									publication: {
										artifactId: input.artifactId,
										projectId: artifact.projectId,
										revisionId: input.revisionId,
										revisionNumber,
									},
								} as const;
							}),
						)
						.pipe(Effect.mapError(infrastructureError)),
				createArtifact: (input) =>
					db
						.transaction((tx) =>
							Effect.gen(function* () {
								const idempotencyKey = scopedIdempotencyKey(
									input.ownerUserId,
									input.idempotencyKey,
								);
								yield* tx.execute(
									sql`select pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`,
								);
								const project = yield* tx
									.select({ id: projectsTable.id })
									.from(projectsTable)
									.where(
										and(
											eq(projectsTable.id, input.projectId),
											eq(projectsTable.ownerUserId, input.ownerUserId),
										),
									)
									.limit(1);
								if (project.length === 0)
									return { _tag: "projectNotFound" } as const;
								const replayRows = yield* tx
									.select()
									.from(revisionsTable)
									.where(
										eq(
											revisionsTable.publicationIdempotencyKey,
											idempotencyKey,
										),
									)
									.limit(1);
								const replay = replayRows[0];
								if (replay !== undefined) {
									const artifactRows = yield* tx
										.select({ artifact: artifactsTable })
										.from(artifactsTable)
										.innerJoin(
											projectsTable,
											eq(projectsTable.id, artifactsTable.projectId),
										)
										.where(
											and(
												eq(artifactsTable.id, replay.artifactId),
												eq(projectsTable.ownerUserId, input.ownerUserId),
											),
										)
										.limit(1);
									const artifact = artifactRows[0]?.artifact;
									return replay.publicationRequestHash === input.requestHash &&
										artifact?.projectId === input.projectId
										? ({
												_tag: "replayed",
												publication: {
													artifactId: replay.artifactId,
													projectId: input.projectId,
													revisionId: replay.id,
													revisionNumber: replay.number,
												},
											} satisfies CreateArtifactResult)
										: ({ _tag: "conflict" } satisfies CreateArtifactResult);
								}
								yield* tx.insert(artifactsTable).values({
									createdAt: input.now,
									currentRevisionNumber: 1,
									id: input.artifactId,
									projectId: input.projectId,
									updatedAt: input.now,
								});
								yield* tx.insert(revisionsTable).values({
									artifactId: input.artifactId,
									createdAt: input.now,
									description: input.description,
									id: input.revisionId,
									number: 1,
									publicationIdempotencyKey: idempotencyKey,
									publicationRequestHash: input.requestHash,
									source: input.source,
									sourceFormatVersion: input.sourceFormatVersion,
									title: input.title,
								});
								return {
									_tag: "created",
									publication: {
										artifactId: input.artifactId,
										projectId: input.projectId,
										revisionId: input.revisionId,
										revisionNumber: 1,
									},
								} as const;
							}),
						)
						.pipe(Effect.mapError(infrastructureError)),
				createProject: (input) =>
					db
						.transaction((tx) =>
							Effect.gen(function* () {
								const idempotencyKey = scopedIdempotencyKey(
									input.ownerUserId,
									input.idempotencyKey,
								);
								yield* tx.execute(
									sql`select pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`,
								);
								const rows = yield* tx
									.select()
									.from(projectsTable)
									.where(
										eq(projectsTable.creationIdempotencyKey, idempotencyKey),
									)
									.limit(1);
								const existing = rows[0];
								if (existing !== undefined) {
									return existing.ownerUserId === input.ownerUserId &&
										existing.creationRequestHash === input.requestHash
										? ({
												_tag: "replayed",
												project: asProject(existing),
											} satisfies CreateProjectResult)
										: ({ _tag: "conflict" } satisfies CreateProjectResult);
								}
								const inserted = yield* tx
									.insert(projectsTable)
									.values({
										createdAt: input.now,
										creationIdempotencyKey: idempotencyKey,
										creationRequestHash: input.requestHash,
										id: input.id,
										name: input.name,
										ownerUserId: input.ownerUserId,
										updatedAt: input.now,
									})
									.returning();
								const insertedProject = inserted[0];
								if (insertedProject === undefined) {
									return yield* Effect.fail(
										new Error("PostgreSQL did not return the created Project."),
									);
								}
								return {
									_tag: "created",
									project: asProject(insertedProject),
								} as const;
							}),
						)
						.pipe(Effect.mapError(infrastructureError)),
				deleteArtifact: (ownerUserId, artifactId) =>
					db
						.transaction((tx) =>
							tx
								.select({ id: artifactsTable.id })
								.from(artifactsTable)
								.innerJoin(
									projectsTable,
									eq(projectsTable.id, artifactsTable.projectId),
								)
								.where(
									and(
										eq(artifactsTable.id, artifactId),
										eq(projectsTable.ownerUserId, ownerUserId),
									),
								)
								.limit(1)
								.pipe(
									Effect.flatMap((owned) =>
										owned.length === 0
											? Effect.succeed(false)
											: tx
													.delete(artifactsTable)
													.where(eq(artifactsTable.id, artifactId))
													.returning({ id: artifactsTable.id })
													.pipe(Effect.map((rows) => rows.length > 0)),
									),
								),
						)
						.pipe(Effect.mapError(infrastructureError)),
				deleteProject: (ownerUserId, projectId) =>
					db
						.delete(projectsTable)
						.where(
							and(
								eq(projectsTable.id, projectId),
								eq(projectsTable.ownerUserId, ownerUserId),
							),
						)
						.returning({ id: projectsTable.id })
						.pipe(
							Effect.map((rows) => rows.length > 0),
							Effect.mapError(infrastructureError),
						),
				getArtifact: (ownerUserId, artifactId) =>
					readArtifact(artifactId, ownerUserId).pipe(
						Effect.mapError(infrastructureError),
					),
				getPublicArtifact: (artifactId) =>
					readArtifact(artifactId).pipe(Effect.mapError(infrastructureError)),
				getProject: (ownerUserId, projectId) =>
					db
						.select()
						.from(projectsTable)
						.where(
							and(
								eq(projectsTable.id, projectId),
								eq(projectsTable.ownerUserId, ownerUserId),
							),
						)
						.limit(1)
						.pipe(
							Effect.map((rows) =>
								Option.fromNullishOr(rows[0]).pipe(Option.map(asProject)),
							),
							Effect.mapError(infrastructureError),
						),
				getPublicProject: (projectId) =>
					db
						.select()
						.from(projectsTable)
						.where(eq(projectsTable.id, projectId))
						.limit(1)
						.pipe(
							Effect.map((rows) =>
								Option.fromNullishOr(rows[0]).pipe(Option.map(asProject)),
							),
							Effect.mapError(infrastructureError),
						),
				getRevision: (ownerUserId, artifactId, revisionNumber) =>
					readRevision(artifactId, revisionNumber, ownerUserId).pipe(
						Effect.mapError(infrastructureError),
					),
				getPublicRevision: (artifactId, revisionNumber) =>
					readRevision(artifactId, revisionNumber).pipe(
						Effect.mapError(infrastructureError),
					),
				listArtifacts: (ownerUserId, projectId) =>
					Effect.gen(function* () {
						const project = yield* db
							.select({ id: projectsTable.id })
							.from(projectsTable)
							.where(
								and(
									eq(projectsTable.id, projectId),
									eq(projectsTable.ownerUserId, ownerUserId),
								),
							)
							.limit(1);
						if (project.length === 0)
							return Option.none<ReadonlyArray<ArtifactSummary>>();
						const records = yield* db
							.select()
							.from(artifactsTable)
							.where(eq(artifactsTable.projectId, projectId))
							.orderBy(desc(artifactsTable.updatedAt));
						const summaries = yield* Effect.forEach(records, (record) =>
							readArtifact(record.id, ownerUserId).pipe(
								Effect.flatMap(
									Option.match({
										onNone: () =>
											Effect.fail(
												new Error("Artifact disappeared while listing."),
											),
										onSome: ({ revisions: _, ...artifact }) =>
											Effect.succeed(new ArtifactSummary(artifact)),
									}),
								),
							),
						);
						return Option.some(summaries);
					}).pipe(Effect.mapError(infrastructureError)),
				listProjects: (ownerUserId) =>
					Effect.gen(function* () {
						const projectRows = yield* db
							.select()
							.from(projectsTable)
							.where(eq(projectsTable.ownerUserId, ownerUserId))
							.orderBy(desc(projectsTable.updatedAt));
						const countRows = yield* db
							.select({
								artifactCount: sql<number>`count(*)::int`,
								projectId: artifactsTable.projectId,
							})
							.from(artifactsTable)
							.groupBy(artifactsTable.projectId);
						const counts = new Map(
							countRows.map((row) => [row.projectId, row.artifactCount]),
						);
						return projectRows.map((row) => ({
							artifactCount: counts.get(row.id) ?? 0,
							project: asProject(row),
						}));
					}).pipe(Effect.mapError(infrastructureError)),
				renameProject: (ownerUserId, projectId, name, now) =>
					db
						.update(projectsTable)
						.set({ name, updatedAt: now })
						.where(
							and(
								eq(projectsTable.id, projectId),
								eq(projectsTable.ownerUserId, ownerUserId),
							),
						)
						.returning()
						.pipe(
							Effect.map((rows) =>
								Option.fromNullishOr(rows[0]).pipe(Option.map(asProject)),
							),
							Effect.mapError(infrastructureError),
						),
			};

			return ArtiflowRepository.of(repository);
		}),
	);

	return RepositoryLive.pipe(Layer.provide(PgLive));
};
