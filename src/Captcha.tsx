import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
} from "react";
import { useScriptLoader } from "./hooks/useScriptLoader";
import { getProvider } from "./providers";
import type { CaptchaProps, CaptchaRef, ProviderRenderOptions } from "./types";

export const Captcha = forwardRef<CaptchaRef, CaptchaProps>(function Captcha(
	{
		provider: providerName,
		siteKey,
		onVerify,
		onError,
		onExpire,
		onLoad,
		theme = "light",
		size = "normal",
		language,
		tabIndex,
		className,
		style,
	},
	ref,
) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | number | null>(null);
	const responseRef = useRef<string | null>(null);
	const resolveExecuteRef = useRef<((token: string) => void) | null>(null);

	const provider = getProvider(providerName);

	const handleScriptLoad = useCallback(() => {
		onLoad?.();
	}, [onLoad]);

	const handleScriptError = useCallback(
		(error: Error) => {
			onError?.(error);
		},
		[onError],
	);

	const { isLoaded, error } = useScriptLoader({
		provider,
		language,
		onLoad: handleScriptLoad,
		onError: handleScriptError,
	});

	// Handle verification callback
	const handleVerify = useCallback(
		(token: string) => {
			responseRef.current = token;
			onVerify(token);
			// Resolve execute promise if pending
			if (resolveExecuteRef.current) {
				resolveExecuteRef.current(token);
				resolveExecuteRef.current = null;
			}
		},
		[onVerify],
	);

	// Handle error callback
	const handleError = useCallback(
		(err: Error) => {
			responseRef.current = null;
			onError?.(err);
		},
		[onError],
	);

	// Handle expiration callback
	const handleExpire = useCallback(() => {
		responseRef.current = null;
		onExpire?.();
	}, [onExpire]);

	// Render widget when script is loaded
	useEffect(() => {
		if (!isLoaded || !containerRef.current || widgetIdRef.current !== null) {
			return;
		}

		// Clear any previous content
		containerRef.current.innerHTML = "";

		try {
			const options: ProviderRenderOptions = {
				sitekey: siteKey,
				callback: handleVerify,
				"error-callback": handleError,
				"expired-callback": handleExpire,
				theme: theme === "auto" ? undefined : theme,
				size,
				tabindex: tabIndex,
				hl: language,
			};

			widgetIdRef.current = provider.render(containerRef.current, options);
		} catch (err) {
			onError?.(err instanceof Error ? err : new Error(String(err)));
		}
	}, [
		isLoaded,
		provider,
		siteKey,
		handleVerify,
		handleError,
		handleExpire,
		theme,
		size,
		tabIndex,
		language,
		onError,
	]);

	// Cleanup on unmount or provider change
	useEffect(() => {
		return () => {
			if (widgetIdRef.current !== null) {
				try {
					provider.reset(widgetIdRef.current);
				} catch {
					// Ignore cleanup errors
				}
				widgetIdRef.current = null;
			}
			responseRef.current = null;
		};
	}, [provider]);

	// Expose ref methods
	useImperativeHandle(
		ref,
		() => ({
			reset() {
				if (widgetIdRef.current !== null) {
					provider.reset(widgetIdRef.current);
					responseRef.current = null;
				}
			},

			execute() {
				return new Promise<string>((resolve, reject) => {
					if (widgetIdRef.current === null) {
						reject(new Error("Captcha widget not initialized"));
						return;
					}

					// If already have a response, return it
					if (responseRef.current) {
						resolve(responseRef.current);
						return;
					}

					// Store resolve function for callback
					resolveExecuteRef.current = resolve;

					try {
						provider.execute(widgetIdRef.current);
					} catch (err) {
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

	if (error) {
		return null;
	}

	return <div ref={containerRef} className={className} style={style} />;
});
