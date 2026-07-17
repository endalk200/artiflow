"use client";

import { Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

type MermaidTheme = "dark" | "neutral";

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

const clampScale = (value: number) =>
	Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

function FullscreenViewer({
	onClose,
	svg,
}: {
	readonly onClose: () => void;
	readonly svg: string;
}) {
	const viewport = useRef<HTMLDivElement>(null);
	const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
	const drag = useRef<{
		originX: number;
		originY: number;
		pointerId: number;
		startX: number;
		startY: number;
	} | null>(null);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [onClose]);

	useEffect(() => {
		const element = viewport.current;
		if (element === null) return;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const bounds = element.getBoundingClientRect();
			const cursorX = event.clientX - bounds.left;
			const cursorY = event.clientY - bounds.top;
			setTransform((current) => {
				const scale = clampScale(
					current.scale * Math.exp(-event.deltaY * 0.0015),
				);
				const ratio = scale / current.scale;
				return {
					scale,
					x: cursorX - (cursorX - current.x) * ratio,
					y: cursorY - (cursorY - current.y) * ratio,
				};
			});
		};
		element.addEventListener("wheel", onWheel, { passive: false });
		return () => element.removeEventListener("wheel", onWheel);
	}, []);

	const zoomBy = useCallback((factor: number) => {
		const element = viewport.current;
		const bounds = element?.getBoundingClientRect();
		const centerX = bounds === undefined ? 0 : bounds.width / 2;
		const centerY = bounds === undefined ? 0 : bounds.height / 2;
		setTransform((current) => {
			const scale = clampScale(current.scale * factor);
			const ratio = scale / current.scale;
			return {
				scale,
				x: centerX - (centerX - current.x) * ratio,
				y: centerY - (centerY - current.y) * ratio,
			};
		});
	}, []);

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = {
			originX: transform.x,
			originY: transform.y,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
		};
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const active = drag.current;
		if (active === null || active.pointerId !== event.pointerId) return;
		setTransform((current) => ({
			...current,
			x: active.originX + (event.clientX - active.startX),
			y: active.originY + (event.clientY - active.startY),
		}));
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (drag.current?.pointerId === event.pointerId) drag.current = null;
	};

	return createPortal(
		<div
			aria-label="Diagram fullscreen view"
			className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
			role="dialog"
		>
			<div className="flex items-center justify-between border-b bg-background px-4 py-2">
				<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Diagram · scroll to zoom, drag to pan
				</p>
				<div className="flex items-center gap-1">
					<button
						aria-label="Zoom out"
						className="inline-flex size-8 items-center justify-center border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						onClick={() => zoomBy(1 / 1.25)}
						type="button"
					>
						<Minus aria-hidden className="size-4" />
					</button>
					<span className="w-14 text-center font-mono text-xs text-muted-foreground tabular-nums">
						{Math.round(transform.scale * 100)}%
					</span>
					<button
						aria-label="Zoom in"
						className="inline-flex size-8 items-center justify-center border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						onClick={() => zoomBy(1.25)}
						type="button"
					>
						<Plus aria-hidden className="size-4" />
					</button>
					<button
						aria-label="Reset view"
						className="ml-1 inline-flex size-8 items-center justify-center border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}
						type="button"
					>
						<RotateCcw aria-hidden className="size-4" />
					</button>
					<button
						aria-label="Close fullscreen"
						className="ml-1 inline-flex size-8 items-center justify-center border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						onClick={onClose}
						type="button"
					>
						<X aria-hidden className="size-4" />
					</button>
				</div>
			</div>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: pointer handlers implement canvas panning */}
			<div
				className="relative flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
				onDoubleClick={() => setTransform({ scale: 1, x: 0, y: 0 })}
				onPointerCancel={onPointerUp}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				ref={viewport}
			>
				<div
					className="flex size-full items-center justify-center [&_svg]:h-auto [&_svg]:max-w-none"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid output is rendered with securityLevel strict
					dangerouslySetInnerHTML={{ __html: svg }}
					style={{
						transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
						transformOrigin: "0 0",
					}}
				/>
			</div>
		</div>,
		document.body,
	);
}

export const MermaidDiagram = Object.assign(
	function MermaidDiagram({ chart }: { readonly chart: string }) {
		const generatedId = useId().replaceAll(":", "");
		const [svg, setSvg] = useState<string>();
		const [error, setError] = useState<string>();
		const [theme, setTheme] = useState<MermaidTheme>();
		const [fullscreen, setFullscreen] = useState(false);

		useEffect(() => {
			const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
			const synchronizeTheme = () =>
				setTheme(colorScheme.matches ? "dark" : "neutral");

			synchronizeTheme();
			colorScheme.addEventListener("change", synchronizeTheme);
			return () => colorScheme.removeEventListener("change", synchronizeTheme);
		}, []);

		useEffect(() => {
			if (theme === undefined) return;
			let cancelled = false;
			const render = async () => {
				try {
					setError(undefined);
					const mermaid = (await import("mermaid")).default;
					mermaid.initialize({
						securityLevel: "strict",
						startOnLoad: false,
						theme,
					});
					const result = await mermaid.render(
						`artiflow-mermaid-${generatedId}`,
						chart,
					);
					if (!cancelled) setSvg(result.svg);
				} catch (cause) {
					if (!cancelled) {
						setError(
							cause instanceof Error
								? cause.message
								: "Diagram could not be rendered.",
						);
					}
				}
			};
			void render();
			return () => {
				cancelled = true;
			};
		}, [chart, generatedId, theme]);

		if (error) {
			return (
				<div
					className="rounded-lg border border-destructive/30 bg-destructive/10 p-4"
					role="alert"
				>
					<p className="font-medium text-destructive">Diagram render failed</p>
					<p className="mt-1 text-sm text-muted-foreground">{error}</p>
					<pre className="mt-4 overflow-x-auto text-xs">{chart}</pre>
				</div>
			);
		}

		return (
			<div className="group relative">
				{svg !== undefined ? (
					<button
						aria-label="View diagram fullscreen"
						className="absolute top-0 right-0 z-10 inline-flex items-center gap-1.5 border bg-background px-2 py-1.5 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
						onClick={() => setFullscreen(true)}
						type="button"
					>
						<Maximize2 aria-hidden className="size-3.5" />
						Fullscreen
					</button>
				) : null}
				<div
					aria-label="Mermaid diagram"
					className="flex min-h-24 justify-center"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid output is rendered with securityLevel strict
					dangerouslySetInnerHTML={
						svg === undefined ? undefined : { __html: svg }
					}
					role="img"
				/>
				{fullscreen && svg !== undefined ? (
					<FullscreenViewer onClose={() => setFullscreen(false)} svg={svg} />
				) : null}
			</div>
		);
	},
	{ artiflowSmokeOpaque: true as const },
);
