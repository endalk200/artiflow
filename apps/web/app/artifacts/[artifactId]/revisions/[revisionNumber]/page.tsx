import { notFound } from "next/navigation";

import { ArtifactPage } from "../../../../../components/artifact/artifact-page";

export default async function HistoricalArtifactPage({
	params,
}: {
	readonly params: Promise<{
		readonly artifactId: string;
		readonly revisionNumber: string;
	}>;
}) {
	const { artifactId, revisionNumber: requestedRevision } = await params;
	const revisionNumber = Number(requestedRevision);
	if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1) notFound();
	return (
		<ArtifactPage artifactId={artifactId} revisionNumber={revisionNumber} />
	);
}
