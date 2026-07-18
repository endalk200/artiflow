import { notFound } from "next/navigation";

import {
	ArtifactPage,
	generateArtifactMetadata,
} from "../../../../../components/artifact/artifact-page";

type HistoricalArtifactPageProps = {
	readonly params: Promise<{
		readonly artifactId: string;
		readonly revisionNumber: string;
	}>;
};

const resolveParams = async ({ params }: HistoricalArtifactPageProps) => {
	const { artifactId, revisionNumber: requestedRevision } = await params;
	const revisionNumber = Number(requestedRevision);
	if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1) notFound();
	return { artifactId, revisionNumber };
};

export async function generateMetadata(props: HistoricalArtifactPageProps) {
	const { artifactId, revisionNumber } = await resolveParams(props);
	return generateArtifactMetadata(artifactId, revisionNumber);
}

export default async function HistoricalArtifactPage(
	props: HistoricalArtifactPageProps,
) {
	const { artifactId, revisionNumber } = await resolveParams(props);
	return (
		<ArtifactPage artifactId={artifactId} revisionNumber={revisionNumber} />
	);
}
