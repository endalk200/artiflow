import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { appConfig } from "@app/config/env";
import { render } from "@react-email/render";
import { Resend } from "resend";

type AuthEmailKind = "password-reset" | "email-verification";

type AuthEmailInput = {
	readonly kind: AuthEmailKind;
	readonly to: string;
	readonly name?: string | null;
	readonly url: string;
};

function AuthEmail({ kind, name, url }: Omit<AuthEmailInput, "to">) {
	const isReset = kind === "password-reset";
	const preview = isReset
		? "Reset your LaunchKey password"
		: "Verify your LaunchKey email";
	const heading = isReset ? "Reset your password" : "Verify your email";
	const body = isReset
		? "Use this link to set a new password for your LaunchKey account."
		: "Use this link to confirm your email address and finish setting up your LaunchKey account.";
	const button = isReset ? "Reset password" : "Verify email";

	return (
		<Html>
			<Head />
			<Preview>{preview}</Preview>
			<Body style={styles.body}>
				<Container style={styles.container}>
					<Heading style={styles.heading}>{heading}</Heading>
					<Text style={styles.text}>Hi {name?.trim() || "there"},</Text>
					<Text style={styles.text}>{body}</Text>
					<Section style={styles.buttonSection}>
						<Button href={url} style={styles.button}>
							{button}
						</Button>
					</Section>
					<Text style={styles.muted}>
						If you did not request this email, you can ignore it.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

const styles = {
	body: {
		backgroundColor: "#f7f7f8",
		color: "#17181c",
		fontFamily:
			'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		margin: "0",
	},
	container: {
		backgroundColor: "#ffffff",
		border: "1px solid #e4e4e7",
		borderRadius: "8px",
		margin: "40px auto",
		maxWidth: "520px",
		padding: "32px",
	},
	heading: {
		fontSize: "24px",
		fontWeight: "600",
		lineHeight: "32px",
		margin: "0 0 24px",
	},
	text: {
		fontSize: "15px",
		lineHeight: "24px",
		margin: "0 0 16px",
	},
	buttonSection: {
		margin: "28px 0",
	},
	button: {
		backgroundColor: "#17181c",
		borderRadius: "8px",
		color: "#ffffff",
		display: "inline-block",
		fontSize: "14px",
		fontWeight: "600",
		padding: "10px 14px",
		textDecoration: "none",
	},
	muted: {
		color: "#71717a",
		fontSize: "13px",
		lineHeight: "20px",
		margin: "0",
	},
} as const;

function subjectFor(kind: AuthEmailKind) {
	return kind === "password-reset"
		? "Reset your LaunchKey password"
		: "Verify your LaunchKey email";
}

export async function sendAuthEmail(input: AuthEmailInput) {
	const apiKey = appConfig.RESEND_API_KEY;

	const email = (
		<AuthEmail kind={input.kind} name={input.name} url={input.url} />
	);
	const html = await render(email);
	const text = await render(email, { plainText: true });
	const resend = new Resend(apiKey);

	const response = await resend.emails.send({
		from: appConfig.AUTH_EMAIL_FROM,
		to: input.to,
		subject: subjectFor(input.kind),
		html,
		text,
	});

	if (response.error) {
		const status = response.error.statusCode
			? ` (status ${response.error.statusCode})`
			: "";

		throw new Error(
			`Resend failed to send auth email: ${response.error.name}${status}: ${response.error.message}`,
		);
	}
}
