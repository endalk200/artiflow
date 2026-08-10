import {
	Artifact,
	ArtifactSummary,
	type InfrastructureError,
	Project,
	Revision,
} from "@app/api-contract/models";
import { Context, Effect, Layer, Option } from "effect";

export type CreateProjectRecord = {
	readonly id: string;
	readonly idempotencyKey: string;
	readonly requestHash: string;
	readonly name: string;
	readonly now: string;
	readonly ownerUserId: string;
};

export type CreateProjectResult =
	| { readonly _tag: "created"; readonly project: Project }
	| { readonly _tag: "replayed"; readonly project: Project }
	| { readonly _tag: "conflict" };

export type CreateArtifactRecord = {
	readonly artifactId: string;
	readonly description?: string;
	readonly idempotencyKey: string;
	readonly now: string;
	readonly ownerUserId: string;
	readonly projectId: string;
	readonly requestHash: string;
	readonly revisionId: string;
	readonly source: string;
	readonly sourceFormatVersion: 1;
	readonly title: string;
};

export type AppendRevisionRecord = Omit<
	CreateArtifactRecord,
	"artifactId" | "projectId"
> & {
	readonly artifactId: string;
	readonly expectedCurrentRevisionId: string;
};

export type StoredRevision = Revision & { readonly source: string };

export type PublicationRecord = {
	readonly artifactId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly revisionNumber: number;
};

export type CreateArtifactResult =
	| {
			readonly _tag: "created" | "replayed";
			readonly publication: PublicationRecord;
	  }
	| { readonly _tag: "conflict" }
	| { readonly _tag: "projectNotFound" };

export type AppendRevisionResult =
	| {
			readonly _tag: "created" | "replayed";
			readonly publication: PublicationRecord;
	  }
	| { readonly _tag: "artifactNotFound" }
	| { readonly _tag: "conflict"; readonly currentRevisionId: string }
	| { readonly _tag: "idempotencyConflict" };

export type ProjectListItem = {
	readonly artifactCount: number;
	readonly project: Project;
};

export type ArtiflowRepositoryShape = {
	readonly appendRevision: (
		input: AppendRevisionRecord,
	) => Effect.Effect<AppendRevisionResult, InfrastructureError>;
	readonly createArtifact: (
		input: CreateArtifactRecord,
	) => Effect.Effect<CreateArtifactResult, InfrastructureError>;
	readonly createProject: (
		input: CreateProjectRecord,
	) => Effect.Effect<CreateProjectResult, InfrastructureError>;
	readonly deleteArtifact: (
		ownerUserId: string,
		artifactId: string,
	) => Effect.Effect<boolean, InfrastructureError>;
	readonly deleteProject: (
		ownerUserId: string,
		projectId: string,
	) => Effect.Effect<boolean, InfrastructureError>;
	readonly getArtifact: (
		ownerUserId: string,
		artifactId: string,
	) => Effect.Effect<Option.Option<Artifact>, InfrastructureError>;
	readonly getPublicArtifact: (
		artifactId: string,
	) => Effect.Effect<Option.Option<Artifact>, InfrastructureError>;
	readonly getProject: (
		ownerUserId: string,
		projectId: string,
	) => Effect.Effect<Option.Option<Project>, InfrastructureError>;
	readonly getPublicProject: (
		projectId: string,
	) => Effect.Effect<Option.Option<Project>, InfrastructureError>;
	readonly getRevision: (
		ownerUserId: string,
		artifactId: string,
		revisionNumber?: number,
	) => Effect.Effect<Option.Option<StoredRevision>, InfrastructureError>;
	readonly getPublicRevision: (
		artifactId: string,
		revisionNumber?: number,
	) => Effect.Effect<Option.Option<StoredRevision>, InfrastructureError>;
	readonly listArtifacts: (
		ownerUserId: string,
		projectId: string,
	) => Effect.Effect<
		Option.Option<ReadonlyArray<ArtifactSummary>>,
		InfrastructureError
	>;
	readonly listProjects: (
		ownerUserId: string,
	) => Effect.Effect<ReadonlyArray<ProjectListItem>, InfrastructureError>;
	readonly renameProject: (
		ownerUserId: string,
		projectId: string,
		name: string,
		now: string,
	) => Effect.Effect<Option.Option<Project>, InfrastructureError>;
};

type StoredProject = {
	readonly project: Project;
	readonly idempotencyKey: string;
	readonly ownerUserId: string;
	readonly requestHash: string;
};

type StoredArtifact = {
	readonly createdAt: string;
	readonly currentRevisionId: string;
	readonly id: string;
	readonly projectId: string;
	readonly updatedAt: string;
};

type StoredPublication = {
	readonly publication: PublicationRecord;
	readonly requestHash: string;
};

const scopedIdempotencyKey = (ownerUserId: string, idempotencyKey: string) =>
	JSON.stringify([ownerUserId, idempotencyKey]);

export class ArtiflowRepository extends Context.Service<
	ArtiflowRepository,
	ArtiflowRepositoryShape
>()("ArtiflowRepository") {
	static readonly testLayer = () =>
		Layer.sync(ArtiflowRepository)(() => {
			const projects = new Map<string, StoredProject>();
			const projectIdsByIdempotencyKey = new Map<string, string>();
			const artifacts = new Map<string, StoredArtifact>();
			const revisions = new Map<string, Array<StoredRevision>>();
			const publications = new Map<string, StoredPublication>();

			const toArtifact = (record: StoredArtifact): Artifact => {
				const history = [...(revisions.get(record.id) ?? [])].sort(
					(a, b) => b.number - a.number,
				);
				const current = history.find(
					(revision) => revision.id === record.currentRevisionId,
				);
				if (current === undefined) {
					throw new Error(`Artifact ${record.id} has no current Revision`);
				}
				return new Artifact({
					createdAt: record.createdAt,
					currentRevisionId: current.id,
					...(current.description === undefined
						? {}
						: { description: current.description }),
					id: record.id,
					projectId: record.projectId,
					revisionCount: history.length,
					revisions: history.map(
						({ source: _, ...revision }) => new Revision(revision),
					),
					title: current.title,
					updatedAt: record.updatedAt,
				});
			};

			const deleteArtifactState = (artifactId: string) => {
				artifacts.delete(artifactId);
				revisions.delete(artifactId);
				for (const [key, value] of publications) {
					if (value.publication.artifactId === artifactId)
						publications.delete(key);
				}
			};

			const ownsProject = (ownerUserId: string, projectId: string) =>
				projects.get(projectId)?.ownerUserId === ownerUserId;

			const ownsArtifact = (ownerUserId: string, artifactId: string) => {
				const artifact = artifacts.get(artifactId);
				return (
					artifact !== undefined && ownsProject(ownerUserId, artifact.projectId)
				);
			};

			const readRevision = (artifactId: string, revisionNumber?: number) => {
				const artifact = artifacts.get(artifactId);
				if (artifact === undefined) return Option.none<StoredRevision>();
				const history = revisions.get(artifactId) ?? [];
				return Option.fromNullishOr(
					revisionNumber === undefined
						? history.find(
								(revision) => revision.id === artifact.currentRevisionId,
							)
						: history.find((revision) => revision.number === revisionNumber),
				);
			};

			return ArtiflowRepository.of({
				appendRevision: (input) =>
					Effect.sync(() => {
						if (!ownsArtifact(input.ownerUserId, input.artifactId)) {
							return { _tag: "artifactNotFound" } as const;
						}
						const idempotencyKey = scopedIdempotencyKey(
							input.ownerUserId,
							input.idempotencyKey,
						);
						const replay = publications.get(idempotencyKey);
						if (replay !== undefined) {
							return replay.requestHash === input.requestHash &&
								replay.publication.artifactId === input.artifactId
								? ({
										_tag: "replayed",
										publication: replay.publication,
									} as const)
								: ({ _tag: "idempotencyConflict" } as const);
						}

						const artifact = artifacts.get(input.artifactId);
						if (artifact === undefined)
							return { _tag: "artifactNotFound" } as const;
						if (
							artifact.currentRevisionId !== input.expectedCurrentRevisionId
						) {
							return {
								_tag: "conflict",
								currentRevisionId: artifact.currentRevisionId,
							} as const;
						}

						const history = revisions.get(input.artifactId) ?? [];
						const number = history.length + 1;
						const revision = new Revision({
							artifactId: input.artifactId,
							createdAt: input.now,
							...(input.description === undefined
								? {}
								: { description: input.description }),
							id: input.revisionId,
							number,
							sourceFormatVersion: input.sourceFormatVersion,
							title: input.title,
						}) as StoredRevision;
						Object.assign(revision, { source: input.source });
						history.push(revision);
						revisions.set(input.artifactId, history);
						artifacts.set(input.artifactId, {
							...artifact,
							currentRevisionId: input.revisionId,
							updatedAt: input.now,
						});
						const publication = {
							artifactId: input.artifactId,
							projectId: artifact.projectId,
							revisionId: input.revisionId,
							revisionNumber: number,
						};
						publications.set(idempotencyKey, {
							publication,
							requestHash: input.requestHash,
						});
						return { _tag: "created", publication } as const;
					}),
				createArtifact: (input) =>
					Effect.sync(() => {
						if (!ownsProject(input.ownerUserId, input.projectId)) {
							return { _tag: "projectNotFound" } as const;
						}
						const idempotencyKey = scopedIdempotencyKey(
							input.ownerUserId,
							input.idempotencyKey,
						);
						const replay = publications.get(idempotencyKey);
						if (replay !== undefined) {
							return replay.requestHash === input.requestHash &&
								replay.publication.projectId === input.projectId
								? ({
										_tag: "replayed",
										publication: replay.publication,
									} as const)
								: ({ _tag: "conflict" } as const);
						}
						const revision = new Revision({
							artifactId: input.artifactId,
							createdAt: input.now,
							...(input.description === undefined
								? {}
								: { description: input.description }),
							id: input.revisionId,
							number: 1,
							sourceFormatVersion: input.sourceFormatVersion,
							title: input.title,
						}) as StoredRevision;
						Object.assign(revision, { source: input.source });
						artifacts.set(input.artifactId, {
							createdAt: input.now,
							currentRevisionId: input.revisionId,
							id: input.artifactId,
							projectId: input.projectId,
							updatedAt: input.now,
						});
						revisions.set(input.artifactId, [revision]);
						const publication = {
							artifactId: input.artifactId,
							projectId: input.projectId,
							revisionId: input.revisionId,
							revisionNumber: 1,
						};
						publications.set(idempotencyKey, {
							publication,
							requestHash: input.requestHash,
						});
						return { _tag: "created", publication } as const;
					}),
				createProject: (input) =>
					Effect.sync(() => {
						const idempotencyKey = scopedIdempotencyKey(
							input.ownerUserId,
							input.idempotencyKey,
						);
						const existingId = projectIdsByIdempotencyKey.get(idempotencyKey);
						if (existingId !== undefined) {
							const existing = projects.get(existingId);
							if (
								existing === undefined ||
								existing.requestHash !== input.requestHash
							) {
								return { _tag: "conflict" } as const;
							}
							return { _tag: "replayed", project: existing.project } as const;
						}

						const project = new Project({
							createdAt: input.now,
							id: input.id,
							name: input.name,
							updatedAt: input.now,
						});
						projects.set(input.id, {
							idempotencyKey,
							ownerUserId: input.ownerUserId,
							project,
							requestHash: input.requestHash,
						});
						projectIdsByIdempotencyKey.set(idempotencyKey, input.id);
						return { _tag: "created", project } as const;
					}),
				deleteArtifact: (ownerUserId, artifactId) =>
					Effect.sync(() => {
						if (!ownsArtifact(ownerUserId, artifactId)) return false;
						deleteArtifactState(artifactId);
						return true;
					}),
				deleteProject: (ownerUserId, projectId) =>
					Effect.sync(() => {
						const existing = projects.get(projectId);
						if (existing?.ownerUserId !== ownerUserId) return false;
						for (const artifact of artifacts.values()) {
							if (artifact.projectId === projectId)
								deleteArtifactState(artifact.id);
						}
						projects.delete(projectId);
						projectIdsByIdempotencyKey.delete(existing.idempotencyKey);
						return true;
					}),
				getArtifact: (ownerUserId, artifactId) =>
					Effect.sync(() =>
						ownsArtifact(ownerUserId, artifactId)
							? Option.fromNullishOr(artifacts.get(artifactId))
							: Option.none<StoredArtifact>(),
					).pipe(Effect.map(Option.map(toArtifact))),
				getPublicArtifact: (artifactId) =>
					Effect.sync(() =>
						Option.fromNullishOr(artifacts.get(artifactId)),
					).pipe(Effect.map(Option.map(toArtifact))),
				getProject: (ownerUserId, projectId) =>
					Effect.sync(() => {
						const stored = projects.get(projectId);
						return stored?.ownerUserId === ownerUserId
							? Option.some(stored.project)
							: Option.none<Project>();
					}),
				getPublicProject: (projectId) =>
					Effect.sync(() =>
						Option.fromNullishOr(projects.get(projectId)?.project),
					),
				getRevision: (ownerUserId, artifactId, revisionNumber) =>
					Effect.sync(() =>
						ownsArtifact(ownerUserId, artifactId)
							? readRevision(artifactId, revisionNumber)
							: Option.none<StoredRevision>(),
					),
				getPublicRevision: (artifactId, revisionNumber) =>
					Effect.sync(() => readRevision(artifactId, revisionNumber)),
				listArtifacts: (ownerUserId, projectId) =>
					Effect.sync(() => {
						if (!ownsProject(ownerUserId, projectId))
							return Option.none<ReadonlyArray<ArtifactSummary>>();
						const summaries = [...artifacts.values()]
							.filter((artifact) => artifact.projectId === projectId)
							.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
							.map((artifact) => {
								const { revisions: _, ...summary } = toArtifact(artifact);
								return new ArtifactSummary(summary);
							});
						return Option.some(summaries);
					}),
				listProjects: (ownerUserId) =>
					Effect.sync(() =>
						[...projects.values()]
							.filter((stored) => stored.ownerUserId === ownerUserId)
							.map(({ project }) => ({
								artifactCount: [...artifacts.values()].filter(
									(artifact) => artifact.projectId === project.id,
								).length,
								project,
							}))
							.sort((a, b) =>
								b.project.updatedAt.localeCompare(a.project.updatedAt),
							),
					),
				renameProject: (ownerUserId, projectId, name, now) =>
					Effect.sync(() => {
						const existing = projects.get(projectId);
						if (existing?.ownerUserId !== ownerUserId) return Option.none();
						const project = new Project({
							...existing.project,
							name,
							updatedAt: now,
						});
						projects.set(projectId, { ...existing, project });
						return Option.some(project);
					}),
			});
		});
}
