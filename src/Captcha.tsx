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

// Every prop the providers read at render time. Deliberately exhaustive over
// CaptchaProps — adding a new render-relevant prop must extend this list or
// changing it won't rebuild the widget.
const SIGNATURE_KEYS = [
	"provider",
	"siteKey",
	"theme",
	"size",
	"tabIndex",
	"language",
	"badge",
	// hcaptcha
	// (onChallengeExpired/onOpen/onClose are user callbacks — identity changes
	// are picked up through the latest-ref wrappers, not rebuilds.)
	// cloudflare
	"action",
	"cData",
	"appearance",
	"execution",
	"retry",
	"retryInterval",
	"refreshExpired",
	"refreshTimeout",
	"responseField",
	"responseFieldName",
	"feedbackEnabled",
] as const;

export const Captcha = forwardRef<CaptchaRef, CaptchaProps>(function Captcha(
	props,
	ref,
) {
	const { provider: providerName, language, className, style, nonce } = props;

	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | number | null>(null);
	const responseRef = useRef<string | null>(null);
	// Whether the current `responseRef` token has already been handed to an
	// execute() caller. Captcha tokens are single-use, so a token that's been
	// delivered once must never be re-served — the next execute() mints a fresh
	// one instead. A freshly-solved-but-undelivered token (e.g. a visible widget
	// the user just solved) is still returned immediately.
	const deliveredRef = useRef(false);
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
			if ("token" in outcome) {
				// Delivering a challenge-driven token to its execute() caller.
				deliveredRef.current = true;
				pending.resolve(outcome.token);
			} else pending.reject(outcome.error);
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
				deliveredRef.current = false;
				onVerifyRef.current(token);
				settlePendingExecute({ token });
			},
			onError(err) {
				responseRef.current = null;
				deliveredRef.current = false;
				onErrorRef.current?.(err);
			},
			onExpire() {
				responseRef.current = null;
				deliveredRef.current = false;
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

	// Signature of the render-time configuration. Built from an explicit list of
	// the fields providers actually read, so functions and presentational props
	// (className/style) never trigger a rebuild and the pick stays cheap even
	// when consumers pass a fresh props object every render.
	const signature = useMemo(() => {
		const p = props as unknown as Record<string, unknown>;
		const picked: Record<string, unknown> = {};
		for (const key of SIGNATURE_KEYS) picked[key] = p[key];
		return JSON.stringify(picked);
	}, [props]);

	useEffect(() => {
		if (!isLoaded || !containerRef.current) return;

		// Captured in locals so the cleanup below always tears down *this*
		// render's widget, even if a newer effect run has since replaced the
		// refs (and so the container is still available during unmount
		// cleanup, after React has detached the ref).
		const container = containerRef.current;
		let widgetId: string | number | null = null;
		try {
			const options = provider.buildOptions(propsRef.current, handlers);
			widgetId = provider.render(container, options);
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
					if (provider.remove) provider.remove(widgetId, container);
					else provider.reset(widgetId);
				} catch {
					// ignore — best-effort cleanup
				}
			}
			widgetIdRef.current = null;
			responseRef.current = null;
			deliveredRef.current = false;
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
					try {
						provider.reset(widgetIdRef.current);
					} catch {
						// ignore — best-effort cleanup, like the effect teardown
					}
					responseRef.current = null;
					deliveredRef.current = false;
					// A reset invalidates whatever an in-flight execute() was waiting on.
					settlePendingExecute({
						error: new Error("Captcha was reset before verification"),
					});
				}
			},

			execute(signal, options) {
				return new Promise<string>((resolve, reject) => {
					if (signal?.aborted) {
						reject(signal.reason ?? abortError());
						return;
					}
					if (widgetIdRef.current === null) {
						reject(new Error("Captcha widget not initialized"));
						return;
					}
					// Return a token immediately only if it's never been handed out and
					// the caller hasn't demanded a fresh challenge. Tokens are single-use,
					// so a token we've already delivered must not be re-served.
					if (
						responseRef.current &&
						!deliveredRef.current &&
						!options?.forceChallenge
					) {
						deliveredRef.current = true;
						resolve(responseRef.current);
						return;
					}

					// A stale (already-delivered) or force-refreshed token is still held
					// by the widget; reset it so the provider mints a brand-new one
					// instead of re-returning the consumed value.
					if (responseRef.current) {
						provider.reset(widgetIdRef.current);
						responseRef.current = null;
						deliveredRef.current = false;
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
								// Cancelling the wait also cancels the challenge: dismiss
								// any visible prompt and drop the token so a late provider
								// callback can't leave a stale value for the next execute().
								if (widgetIdRef.current !== null) {
									try {
										provider.reset(widgetIdRef.current);
									} catch {
										// ignore — best-effort cleanup
									}
								}
								responseRef.current = null;
								deliveredRef.current = false;
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
				// A token already delivered to an execute() caller is consumed
				// (captcha tokens are single-use) and must not be handed out again.
				if (deliveredRef.current) return null;
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
