import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import { useLatestRef } from "./hooks/useLatestRef";
import { useScriptLoader } from "./hooks/useScriptLoader";
import { getProvider } from "./providers";
import type { CaptchaProps, CaptchaRef, RenderHandlers } from "./types";

/** An in-flight `execute()` call awaiting a token, the abort, or a teardown. */
interface PendingExecute {
	resolve: (token: string) => void;
	reject: (error: Error) => void;
	cleanup: () => void;
}

export const Captcha = forwardRef<CaptchaRef, CaptchaProps>(function Captcha(
	props,
	ref,
) {
	const { provider: providerName, language, className, style, nonce } = props;

	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | number | null>(null);
	const responseRef = useRef<string | null>(null);
	const pendingExecuteRef = useRef<PendingExecute | null>(null);

	// Settle and clear any in-flight execute() promise. Called when a token
	// arrives, when the caller aborts, when a newer execute() supersedes it, and
	// from every teardown path so a pending promise can never hang forever.
	const settlePendingExecute = useCallback(
		(outcome: { token: string } | { error: Error }) => {
			const pending = pendingExecuteRef.current;
			if (!pending) return;
			pendingExecuteRef.current = null;
			pending.cleanup();
			if ("token" in outcome) pending.resolve(outcome.token);
			else pending.reject(outcome.error);
		},
		[],
	);

	const provider = getProvider(providerName);

	// Latest-ref user callbacks so wrappers can be created once and always invoke
	// the freshest function. Fixes the stale-closure bug where a parent updating
	// its `onVerify` arrow after mount used to be silently ignored.
	const onVerifyRef = useLatestRef(props.onVerify);
	const onErrorRef = useLatestRef(props.onError);
	const onExpireRef = useLatestRef(props.onExpire);
	const onLoadRef = useLatestRef(props.onLoad);

	// Latest-ref the whole prop bag so the render effect can read the freshest
	// config without listing the unstable `props` object as a dependency. The
	// effect is still driven by `signature`, which changes only when a field the
	// provider cares about changes.
	const propsRef = useLatestRef(props);

	const handlers = useMemo<RenderHandlers>(
		() => ({
			onVerify(token) {
				responseRef.current = token;
				onVerifyRef.current(token);
				settlePendingExecute({ token });
			},
			onError(err) {
				responseRef.current = null;
				onErrorRef.current?.(err);
			},
			onExpire() {
				responseRef.current = null;
				onExpireRef.current?.();
			},
		}),
		[onVerifyRef, onErrorRef, onExpireRef, settlePendingExecute],
	);

	const handleScriptLoad = useCallback(() => {
		onLoadRef.current?.();
	}, [onLoadRef]);

	const handleScriptError = useCallback(
		(err: Error) => {
			onErrorRef.current?.(err);
		},
		[onErrorRef],
	);

	const { isLoaded } = useScriptLoader({
		provider,
		language,
		nonce,
		onLoad: handleScriptLoad,
		onError: handleScriptError,
	});

	// Signature of the render-time configuration. Strips functions and presentational
	// fields (className/style) so the widget rebuilds only when something the
	// underlying provider actually cares about changes.
	const signature = useMemo(() => {
		return JSON.stringify(props, (key, value) => {
			if (typeof value === "function") return undefined;
			if (key === "className" || key === "style") return undefined;
			return value;
		});
	}, [props]);

	useEffect(() => {
		if (!isLoaded || !containerRef.current) return;

		// Render the widget. The id is captured in a local so the cleanup below
		// always tears down *this* render's widget, even if a newer effect run has
		// since replaced `widgetIdRef.current`.
		let widgetId: string | number | null = null;
		try {
			const options = provider.buildOptions(propsRef.current, handlers);
			widgetId = provider.render(containerRef.current, options);
			widgetIdRef.current = widgetId;
		} catch (err) {
			onErrorRef.current?.(
				err instanceof Error ? err : new Error(String(err)),
			);
		}

		// React runs this cleanup before each rebuild (signature change) and on
		// unmount. Changing siteKey / theme / size / language therefore tears down
		// the old widget and builds a fresh one instead of being silently ignored.
		return () => {
			if (widgetId !== null) {
				try {
					if (provider.remove) provider.remove(widgetId);
					else provider.reset(widgetId);
				} catch {
					// ignore — best-effort cleanup
				}
			}
			widgetIdRef.current = null;
			responseRef.current = null;
			// Never leave an awaited execute() hanging after its widget is gone.
			settlePendingExecute({
				error: new Error("Captcha widget was torn down before verification"),
			});
		};
		// Rebuilds are driven by `signature` (every provider-relevant scalar field
		// of `props`); the current prop bag is read through `propsRef`.
	}, [
		isLoaded,
		provider,
		signature,
		handlers,
		settlePendingExecute,
		propsRef,
		onErrorRef,
	]);

	useImperativeHandle(
		ref,
		() => ({
			reset() {
				if (widgetIdRef.current !== null) {
					provider.reset(widgetIdRef.current);
					responseRef.current = null;
					// A reset invalidates whatever an in-flight execute() was waiting on.
					settlePendingExecute({
						error: new Error("Captcha was reset before verification"),
					});
				}
			},

			execute(signal) {
				return new Promise<string>((resolve, reject) => {
					if (signal?.aborted) {
						reject(signal.reason ?? abortError());
						return;
					}
					if (widgetIdRef.current === null) {
						reject(new Error("Captcha widget not initialized"));
						return;
					}
					if (responseRef.current) {
						resolve(responseRef.current);
						return;
					}

					// Supersede any earlier pending execute() so its promise can't
					// hang forever once we overwrite the ref below.
					settlePendingExecute({
						error: new Error("execute() superseded by a newer call"),
					});

					const cleanup = () => {
						if (signal && onAbort) signal.removeEventListener("abort", onAbort);
					};

					const onAbort = signal
						? () => {
								if (pendingExecuteRef.current === pending) {
									pendingExecuteRef.current = null;
								}
								cleanup();
								reject(signal.reason ?? abortError());
							}
						: undefined;

					const pending: PendingExecute = { resolve, reject, cleanup };

					if (signal && onAbort) {
						signal.addEventListener("abort", onAbort, { once: true });
					}
					pendingExecuteRef.current = pending;

					try {
						provider.execute(
							widgetIdRef.current,
							containerRef.current ?? undefined,
						);
					} catch (err) {
						if (pendingExecuteRef.current === pending) {
							pendingExecuteRef.current = null;
						}
						cleanup();
						reject(err instanceof Error ? err : new Error(String(err)));
					}
				});
			},

			getResponse() {
				if (widgetIdRef.current !== null) {
					return provider.getResponse(widgetIdRef.current);
				}
				return responseRef.current;
			},
		}),
		[provider, settlePendingExecute],
	);

	return <div ref={containerRef} className={className} style={style} />;
});

function abortError(): Error {
	if (typeof DOMException !== "undefined") {
		return new DOMException("Aborted", "AbortError");
	}
	const err = new Error("Aborted");
	err.name = "AbortError";
	return err;
}
