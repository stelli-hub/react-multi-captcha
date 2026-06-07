import { useEffect, useState } from "react";
import type { ProviderConfig } from "../types";
import { useLatestRef } from "./useLatestRef";

interface UseScriptLoaderOptions {
	provider: ProviderConfig;
	language?: string;
	/** CSP nonce forwarded to the injected provider `<script>`. */
	nonce?: string;
	onLoad?: () => void;
	onError?: (error: Error) => void;
}

interface UseScriptLoaderResult {
	isLoaded: boolean;
	error: Error | null;
}

type LoaderStatus =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready" }
	| { status: "error"; error: Error };

const POLL_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 50;

// Module-level cache shared across every <Captcha> instance.
const loadedScripts = new Set<string>();
const loadingPromises = new Map<string, Promise<void>>();
const injectedPreconnects = new Set<string>();

export function useScriptLoader({
	provider,
	language,
	nonce,
	onLoad,
	onError,
}: UseScriptLoaderOptions): UseScriptLoaderResult {
	const onLoadRef = useLatestRef(onLoad);
	const onErrorRef = useLatestRef(onError);

	const { scriptId } = provider;

	const [state, setState] = useState<LoaderStatus>(() =>
		loadedScripts.has(scriptId) ? { status: "ready" } : { status: "idle" },
	);

	useEffect(() => {
		if (typeof window === "undefined") return;

		let cancelled = false;

		const resolveReady = () => {
			if (cancelled) return;
			setState((prev) => (prev.status === "ready" ? prev : { status: "ready" }));
			onLoadRef.current?.();
		};

		const rejectWith = (err: Error) => {
			if (cancelled) return;
			setState({ status: "error", error: err });
			onErrorRef.current?.(err);
		};

		if (loadedScripts.has(scriptId)) {
			resolveReady();
			return () => {
				cancelled = true;
			};
		}

		setState((prev) =>
			prev.status === "loading" ? prev : { status: "loading" },
		);

		const inflight = loadingPromises.get(scriptId);
		const promise = inflight ?? startLoad(provider, language, nonce);
		if (!inflight) {
			loadingPromises.set(scriptId, promise);
			promise.then(
				() => {
					loadedScripts.add(scriptId);
					loadingPromises.delete(scriptId);
				},
				() => {
					// Drop the cached promise so a remount can retry.
					loadingPromises.delete(scriptId);
				},
			);
		}

		promise.then(resolveReady, rejectWith);

		return () => {
			cancelled = true;
		};
	}, [scriptId, provider, language, nonce, onLoadRef, onErrorRef]);

	return {
		isLoaded: state.status === "ready",
		error: state.status === "error" ? state.error : null,
	};
}

function startLoad(
	provider: ProviderConfig,
	language: string | undefined,
	nonce: string | undefined,
): Promise<void> {
	const { scriptId, scriptUrl, globalVar, callbackName } = provider;

	return new Promise<void>((resolve, reject) => {
		injectPreconnects(provider);

		const w = window as unknown as Record<string, unknown>;
		let settled = false;
		const finalize = (fn: () => void) => {
			if (settled) return;
			settled = true;
			fn();
			if (callbackName in w) delete w[callbackName];
		};

		const existing = document.getElementById(scriptId);
		if (existing) {
			// Another consumer already injected the tag; just wait for the global.
			// Only trust an element we would have created ourselves — a <script>
			// element pointing at the provider's own origin. Refusing anything else
			// avoids being fooled into "loading complete" by an unrelated (or
			// attacker-seeded) DOM node that happens to share our id.
			if (!isTrustedProviderScript(existing, scriptUrl)) {
				finalize(() =>
					reject(
						new Error(
							`Refusing to trust element #${scriptId}: not the expected provider script`,
						),
					),
				);
				return;
			}
			pollForGlobal(
				globalVar,
				() => finalize(resolve),
				(err) => finalize(() => reject(err)),
			);
			return;
		}

		w[callbackName] = () => finalize(resolve);

		const script = document.createElement("script");
		script.id = scriptId;

		const url = new URL(scriptUrl);
		url.searchParams.set("onload", callbackName);
		url.searchParams.set("render", "explicit");
		const extra = provider.scriptUrlParams?.(language) ?? {};
		for (const [k, v] of Object.entries(extra)) {
			url.searchParams.set(k, v);
		}

		script.src = url.toString();
		script.async = true;
		script.defer = true;
		if (nonce) script.nonce = nonce;

		// Belt-and-suspenders: providers should hit the named global callback,
		// but if that ever silently fails we'll still observe `onload`.
		script.onload = () => {
			pollForGlobal(
				globalVar,
				() => finalize(resolve),
				(err) => finalize(() => reject(err)),
			);
		};

		script.onerror = () => {
			finalize(() =>
				reject(new Error(`Failed to load captcha script: ${scriptId}`)),
			);
		};

		document.body.appendChild(script);
	});
}

function isTrustedProviderScript(
	element: HTMLElement,
	scriptUrl: string,
): boolean {
	if (!(element instanceof HTMLScriptElement)) return false;
	try {
		return new URL(element.src).origin === new URL(scriptUrl).origin;
	} catch {
		return false;
	}
}

// Polls for the provider global after the (shared) script tag loads. This is a
// process-wide, one-shot operation keyed by scriptId — it is intentionally NOT
// tied to any single component's lifecycle. A consumer unmounting mid-load must
// not cancel the poll, because sibling <Captcha> instances still depend on the
// same global resolving. The hook's own `cancelled` flag already prevents stale
// state updates into an unmounted component.
function pollForGlobal(
	globalVar: string,
	ok: () => void,
	fail: (err: Error) => void,
) {
	const start = Date.now();
	const tick = () => {
		if (globalVar in window) {
			ok();
			return;
		}
		if (Date.now() - start > POLL_TIMEOUT_MS) {
			fail(new Error(`Timed out waiting for window.${globalVar}`));
			return;
		}
		setTimeout(tick, POLL_INTERVAL_MS);
	};
	tick();
}

function injectPreconnects(provider: ProviderConfig) {
	if (!provider.preconnect) return;
	provider.preconnect.forEach((hint, index) => {
		const key = `${provider.scriptId}-preconnect-${index}`;
		if (injectedPreconnects.has(key)) return;
		if (document.getElementById(key)) {
			injectedPreconnects.add(key);
			return;
		}
		const link = document.createElement("link");
		link.id = key;
		link.rel = "preconnect";
		link.href = hint.href;
		if (hint.crossOrigin) link.crossOrigin = "anonymous";
		document.head.appendChild(link);
		injectedPreconnects.add(key);
	});
}
