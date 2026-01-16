import { useCallback, useEffect, useRef, useState } from "react";
import type { ProviderConfig } from "../types";

interface UseScriptLoaderOptions {
	provider: ProviderConfig;
	language?: string;
	onLoad?: () => void;
	onError?: (error: Error) => void;
}

interface UseScriptLoaderResult {
	isLoaded: boolean;
	isLoading: boolean;
	error: Error | null;
}

// Track loaded scripts globally to avoid duplicate loading
const loadedScripts = new Set<string>();
const loadingPromises = new Map<string, Promise<void>>();

export function useScriptLoader({
	provider,
	language,
	onLoad,
	onError,
}: UseScriptLoaderOptions): UseScriptLoaderResult {
	const [isLoaded, setIsLoaded] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const mountedRef = useRef(true);

	const loadScript = useCallback(() => {
		const { scriptId, scriptUrl, globalVar, callbackName } = provider;

		// Check if already loaded
		if (loadedScripts.has(scriptId)) {
			setIsLoaded(true);
			onLoad?.();
			return;
		}

		// Check if already loading
		const existingPromise = loadingPromises.get(scriptId);
		if (existingPromise) {
			setIsLoading(true);
			existingPromise
				.then(() => {
					if (mountedRef.current) {
						setIsLoaded(true);
						setIsLoading(false);
						onLoad?.();
					}
				})
				.catch((err) => {
					if (mountedRef.current) {
						setError(err);
						setIsLoading(false);
						onError?.(err);
					}
				});
			return;
		}

		// Check if script element already exists
		if (document.getElementById(scriptId)) {
			// Script exists but not yet loaded, wait for global var
			const checkLoaded = () => {
				if (globalVar in window) {
					loadedScripts.add(scriptId);
					if (mountedRef.current) {
						setIsLoaded(true);
						setIsLoading(false);
						onLoad?.();
					}
				} else {
					requestAnimationFrame(checkLoaded);
				}
			};
			setIsLoading(true);
			checkLoaded();
			return;
		}

		setIsLoading(true);

		const loadPromise = new Promise<void>((resolve, reject) => {
			// Create global callback for onload
			Object.assign(window, {
				[callbackName]: () => {
					loadedScripts.add(scriptId);
					loadingPromises.delete(scriptId);
					resolve();
				},
			});

			const script = document.createElement("script");
			script.id = scriptId;

			// Build URL with query params
			const url = new URL(scriptUrl);
			url.searchParams.set("onload", callbackName);
			url.searchParams.set("render", "explicit");
			if (language) {
				url.searchParams.set("hl", language);
			}

			script.src = url.toString();
			script.async = true;
			script.defer = true;

			script.onerror = () => {
				const err = new Error(`Failed to load captcha script: ${scriptId}`);
				loadingPromises.delete(scriptId);
				reject(err);
			};

			document.body.appendChild(script);
		});

		loadingPromises.set(scriptId, loadPromise);

		loadPromise
			.then(() => {
				if (mountedRef.current) {
					setIsLoaded(true);
					setIsLoading(false);
					onLoad?.();
				}
			})
			.catch((err) => {
				if (mountedRef.current) {
					setError(err);
					setIsLoading(false);
					onError?.(err);
				}
			});
	}, [provider, language, onLoad, onError]);

	useEffect(() => {
		mountedRef.current = true;
		loadScript();

		return () => {
			mountedRef.current = false;
		};
	}, [loadScript]);

	return { isLoaded, isLoading, error };
}
