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

export const Captcha = forwardRef<CaptchaRef, CaptchaProps>(function Captcha(
	props,
	ref,
) {
	const { provider: providerName, language, className, style } = props;

	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | number | null>(null);
	const responseRef = useRef<string | null>(null);
	const resolveExecuteRef = useRef<((token: string) => void) | null>(null);

	const provider = getProvider(providerName);

	// Latest-ref user callbacks so wrappers can be created once and always invoke
	// the freshest function. Fixes the stale-closure bug where a parent updating
	// its `onVerify` arrow after mount used to be silently ignored.
	const onVerifyRef = useLatestRef(props.onVerify);
	const onErrorRef = useLatestRef(props.onError);
	const onExpireRef = useLatestRef(props.onExpire);
	const onLoadRef = useLatestRef(props.onLoad);

	const handlers = useMemo<RenderHandlers>(
		() => ({
			onVerify(token) {
				responseRef.current = token;
				onVerifyRef.current(token);
				const resolver = resolveExecuteRef.current;
				if (resolver) {
					resolveExecuteRef.current = null;
					resolver(token);
				}
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
		[onVerifyRef, onErrorRef, onExpireRef],
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

		// Tear down a stale widget if the signature changed mid-life. Changing
		// siteKey / theme / size / language now actually rebuilds the widget
		// instead of being silently ignored.
		if (widgetIdRef.current !== null) {
			try {
				if (provider.remove) provider.remove(widgetIdRef.current);
				else provider.reset(widgetIdRef.current);
			} catch {
				// ignore — best-effort cleanup
			}
			widgetIdRef.current = null;
			responseRef.current = null;
		}

		try {
			const options = provider.buildOptions(props, handlers);
			widgetIdRef.current = provider.render(containerRef.current, options);
		} catch (err) {
			onErrorRef.current?.(
				err instanceof Error ? err : new Error(String(err)),
			);
		}
		// `props` is intentionally accessed via the latest closure; rebuild is
		// driven by `signature`, which encodes every scalar field of `props`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoaded, provider, signature, handlers]);

	useEffect(() => {
		return () => {
			if (widgetIdRef.current !== null) {
				try {
					if (provider.remove) provider.remove(widgetIdRef.current);
					else provider.reset(widgetIdRef.current);
				} catch {
					// ignore
				}
				widgetIdRef.current = null;
			}
			responseRef.current = null;
		};
	}, [provider]);

	useImperativeHandle(
		ref,
		() => ({
			reset() {
				if (widgetIdRef.current !== null) {
					provider.reset(widgetIdRef.current);
					responseRef.current = null;
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

					let wrappedResolve: (token: string) => void;
					const onAbort = signal
						? () => {
								if (resolveExecuteRef.current === wrappedResolve) {
									resolveExecuteRef.current = null;
								}
								reject(signal.reason ?? abortError());
							}
						: undefined;

					wrappedResolve = (token: string) => {
						if (signal && onAbort) signal.removeEventListener("abort", onAbort);
						resolve(token);
					};

					if (signal && onAbort) {
						signal.addEventListener("abort", onAbort, { once: true });
					}
					resolveExecuteRef.current = wrappedResolve;

					try {
						provider.execute(
							widgetIdRef.current,
							containerRef.current ?? undefined,
						);
					} catch (err) {
						if (signal && onAbort) signal.removeEventListener("abort", onAbort);
						resolveExecuteRef.current = null;
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
		[provider],
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
