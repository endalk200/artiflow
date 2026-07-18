import {
	ArtifactPage,
	generateArtifactMetadata,
} from "../../../components/artifact/artifact-page";

type LatestArtifactPageProps = {
	readonly params: Promise<{ readonly artifactId: string }>;
};

export async function generateMetadata({ params }: LatestArtifactPageProps) {
	const { artifactId } = await params;
	return generateArtifactMetadata(artifactId);
}

export default async function LatestArtifactPage({
	params,
}: LatestArtifactPageProps) {
	const { artifactId } = await params;
	return <ArtifactPage artifactId={artifactId} />;
}
