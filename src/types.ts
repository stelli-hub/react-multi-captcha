import type { CSSProperties } from "react";

export type CaptchaProvider = "google" | "hcaptcha" | "cloudflare";

export type CaptchaTheme = "light" | "dark" | "auto";

export type CaptchaSize = "normal" | "compact" | "invisible";

export interface CaptchaProps {
	/** Captcha provider to use */
	provider: CaptchaProvider;
	/** Site key from the captcha provider */
	siteKey: string;
	/** Callback when verification succeeds */
	onVerify: (token: string) => void;
	/** Callback when an error occurs */
	onError?: (error: Error) => void;
	/** Callback when the token expires */
	onExpire?: () => void;
	/** Callback when the captcha widget loads */
	onLoad?: () => void;
	/** Theme for the captcha widget */
	theme?: CaptchaTheme;
	/** Size of the captcha widget */
	size?: CaptchaSize;
	/** Language code for the captcha (e.g., "en", "pt-BR") */
	language?: string;
	/** Tab index for accessibility */
	tabIndex?: number;
	/** Additional CSS class names */
	className?: string;
	/** Inline styles for the container */
	style?: CSSProperties;
}

export interface CaptchaRef {
	/** Reset the captcha widget */
	reset: () => void;
	/** Execute invisible captcha and get token */
	execute: () => Promise<string>;
	/** Get the current response token, or null if not verified */
	getResponse: () => string | null;
}

export interface ProviderConfig {
	scriptId: string;
	scriptUrl: string;
	globalVar: string;
	callbackName: string;
	render: (
		container: HTMLElement,
		options: ProviderRenderOptions,
	) => string | number;
	reset: (widgetId: string | number) => void;
	execute: (widgetId: string | number) => void;
	getResponse: (widgetId: string | number) => string | null;
}

export interface ProviderRenderOptions {
	sitekey: string;
	callback: (token: string) => void;
	"error-callback"?: (error: Error) => void;
	"expired-callback"?: () => void;
	theme?: CaptchaTheme;
	size?: CaptchaSize;
	tabindex?: number;
	hl?: string;
}

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
			execute: (widgetId: string) => Promise<{ response: string }>;
			getResponse: (widgetId: string) => string;
		};
		turnstile?: {
			render: (
				container: HTMLElement,
				options: ProviderRenderOptions,
			) => string;
			reset: (widgetId: string) => void;
			execute: (container: HTMLElement, options?: object) => void;
			getResponse: (widgetId: string) => string | undefined;
		};
	}
}
