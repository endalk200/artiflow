import { PostListController } from "@app/post/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeView } from "./home-view";
import Home from "./page";

const { getServerSessionMock, redirectMock } = vi.hoisted(() => ({
	getServerSessionMock: vi.fn(),
	redirectMock: vi.fn(),
}));

vi.mock("./session", () => ({
	getServerSession: getServerSessionMock,
}));

vi.mock("next/navigation", () => ({
	redirect: redirectMock,
}));

describe("Home", () => {
	beforeEach(() => {
		getServerSessionMock.mockReset();
		redirectMock.mockReset();
	});

	it("renders the authenticated posts page", async () => {
		getServerSessionMock.mockResolvedValue({
			user: {
				email: "user@example.com",
			},
		});

		const page = await Home();

		expect(page.type).toBe(HomeView);
		expect(page.props.email).toBe("user@example.com");
	});

	it("redirects unauthenticated users to sign in", async () => {
		getServerSessionMock.mockResolvedValue(null);
		redirectMock.mockImplementation(() => {
			throw new Error("NEXT_REDIRECT");
		});

		await expect(Home()).rejects.toThrow("NEXT_REDIRECT");

		expect(redirectMock).toHaveBeenCalledWith("/sign-in?callbackURL=%2F");
	});

	it("renders the authenticated posts view", () => {
		const page = HomeView({ email: "user@example.com" });
		const section = page.props.children;
		const [header, controller] = section.props.children;

		expect(page.type).toBe("main");
		expect(page.props.className).toContain("min-h-screen");
		expect(section.type).toBe("section");
		expect(header.type).toBe("header");
		expect(controller.type).toBe(PostListController);
	});
});
