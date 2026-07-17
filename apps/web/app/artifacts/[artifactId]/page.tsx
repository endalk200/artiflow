import { ArtifactPage } from "../../../components/artifact/artifact-page";

export default async function LatestArtifactPage({
	params,
}: {
	readonly params: Promise<{ readonly artifactId: string }>;
}) {
	const { artifactId } = await params;
	return <ArtifactPage artifactId={artifactId} />;
}
