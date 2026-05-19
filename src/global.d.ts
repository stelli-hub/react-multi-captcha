import type { ProviderRenderOptions } from "./types";

declare global {
	interface Window {
		grecaptcha?: {
			render: (
				container: HTMLElement,
				options: ProviderRenderOptions,
			) => number;
			reset: (widgetId: number) => void;
			execute: (widgetId: number) => void;
			getResponse: (widgetId: number) => string;
		};
		hcaptcha?: {
			render: (
				container: HTMLElement,
				options: ProviderRenderOptions,
			) => string;
			reset: (widgetId: string) => void;
			execute: (widgetId: string) => Promise<{ response: string }> | void;
			getResponse: (widgetId: string) => string;
			remove?: (widgetId: string) => void;
		};
		turnstile?: {
			render: (
				container: HTMLElement | string,
				options: ProviderRenderOptions,
			) => string;
			reset: (widgetId: string) => void;
			execute: (container: HTMLElement | string, options?: object) => void;
			getResponse: (widgetId: string) => string | undefined;
			remove: (widgetId: string) => void;
			isExpired: (widgetId: string) => boolean;
			ready: (cb: () => void) => void;
		};
	}
}

export {};
