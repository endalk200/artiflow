import { redirect } from "next/navigation";
import { HomeView } from "./home-view";
import { getServerSession } from "./session";

export default async function Home() {
	const session = await getServerSession();

	if (!session) {
		redirect("/sign-in?callbackURL=%2F");
	}

	return <HomeView email={session.user.email} />;
}
