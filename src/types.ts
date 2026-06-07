import type { CSSProperties } from "react";

export type CaptchaProvider = "google" | "hcaptcha" | "cloudflare";

export type CaptchaTheme = "light" | "dark" | "auto";

type CommonSize = "normal" | "compact";
export type GoogleSize = CommonSize | "invisible";
export type HCaptchaSize = CommonSize | "invisible";
export type TurnstileSize = CommonSize | "flexible";
export type CaptchaSize = GoogleSize | HCaptchaSize | TurnstileSize;

export type TurnstileAppearance = "always" | "execute" | "interaction-only";
export type TurnstileExecution = "render" | "execute";
export type TurnstileRetry = "auto" | "never";
export type TurnstileRefreshExpired = "auto" | "manual" | "never";
export type TurnstileRefreshTimeout = "auto" | "manual" | "never";

export type GoogleBadge = "bottomright" | "bottomleft" | "inline";

interface CaptchaPropsBase {
	/** Site key from the captcha provider */
	siteKey: string;
	/** Callback when verification succeeds */
	onVerify: (token: string) => void;
	/** Callback when an error occurs (script load, render, or runtime) */
	onError?: (error: Error) => void;
	/** Callback when the token expires */
	onExpire?: () => void;
	/** Callback when the provider script finishes loading */
	onLoad?: () => void;
	/** Theme for the captcha widget */
	theme?: CaptchaTheme;
	/**
	 * Language code for the captcha (e.g., "en", "pt-BR").
	 *
	 * Note: reCAPTCHA and hCaptcha read the language from the script URL, which
	 * is fetched once and cached process-wide. Changing `language` after the
	 * script has loaded therefore has no effect for those providers (a full page
	 * reload is required to switch). Turnstile reads it per-render, so it updates
	 * live.
	 */
	language?: string;
	/** Tab index for accessibility */
	tabIndex?: number;
	/** Additional CSS class names */
	className?: string;
	/** Inline styles for the container */
	style?: CSSProperties;
	/**
	 * CSP nonce applied to the dynamically injected provider `<script>`.
	 * Required when the host page enforces a strict `script-src 'nonce-…'`
	 * policy, otherwise the provider script is blocked and the captcha
	 * silently fails to load.
	 */
	nonce?: string;
}

export interface GoogleCaptchaProps extends CaptchaPropsBase {
	provider: "google";
	size?: GoogleSize;
	/** Reposition the reCAPTCHA badge (invisible reCAPTCHA only). */
	badge?: GoogleBadge;
}

export interface HCaptchaCaptchaProps extends CaptchaPropsBase {
	provider: "hcaptcha";
	size?: HCaptchaSize;
	onChallengeExpired?: () => void;
	onOpen?: () => void;
	onClose?: () => void;
}

export interface TurnstileCaptchaProps extends CaptchaPropsBase {
	provider: "cloudflare";
	size?: TurnstileSize;
	action?: string;
	cData?: string;
	appearance?: TurnstileAppearance;
	execution?: TurnstileExecution;
	retry?: TurnstileRetry;
	retryInterval?: number;
	refreshExpired?: TurnstileRefreshExpired;
	refreshTimeout?: TurnstileRefreshTimeout;
	responseField?: boolean;
	responseFieldName?: string;
	feedbackEnabled?: boolean;
	onTimeout?: () => void;
	onBeforeInteractive?: () => void;
	onAfterInteractive?: () => void;
	onUnsupported?: () => void;
}

export type CaptchaProps =
	| GoogleCaptchaProps
	| HCaptchaCaptchaProps
	| TurnstileCaptchaProps;

export interface CaptchaRef {
	/** Reset the captcha widget */
	reset: () => void;
	/**
	 * Execute the captcha (for invisible widgets or Turnstile `execution: "execute"`).
	 * Pass an `AbortSignal` to cancel the pending verification.
	 *
	 * If a token already exists (the widget verified earlier and has not expired
	 * or been reset), the returned promise resolves immediately with that cached
	 * token rather than triggering a fresh challenge. Captcha tokens are
	 * single-use: always verify them server-side and call `reset()` before
	 * `execute()` when you need a brand-new token for a second action.
	 */
	execute: (signal?: AbortSignal) => Promise<string>;
	/** Get the current response token, or null if not verified */
	getResponse: () => string | null;
}

/**
 * Stable handlers forwarded by `<Captcha>` to each provider. Providers should
 * forward these directly into the underlying widget's callback slots without
 * adding indirection — the wrappers already proxy to the latest user callback.
 */
export interface RenderHandlers {
	onVerify: (token: string) => void;
	onError: (error: Error) => void;
	onExpire: () => void;
}

/**
 * Union of every render-option key any provider accepts. Each provider's
 * `buildOptions` only emits the subset it actually uses; consumers should
 * not construct this type directly.
 */
export interface ProviderRenderOptions {
	sitekey: string;
	callback: (token: string) => void;
	"error-callback"?: (error: Error) => void;
	"expired-callback"?: () => void;
	"chalexpired-callback"?: () => void;
	"open-callback"?: () => void;
	"close-callback"?: () => void;
	"timeout-callback"?: () => void;
	"before-interactive-callback"?: () => void;
	"after-interactive-callback"?: () => void;
	"unsupported-callback"?: () => void;
	theme?: CaptchaTheme;
	size?: CaptchaSize;
	tabindex?: number;
	badge?: GoogleBadge;
	/** reCAPTCHA / hCaptcha language code */
	hl?: string;
	/** Turnstile language code */
	language?: string;
	action?: string;
	cData?: string;
	appearance?: TurnstileAppearance;
	execution?: TurnstileExecution;
	retry?: TurnstileRetry;
	"retry-interval"?: number;
	"refresh-expired"?: TurnstileRefreshExpired;
	"refresh-timeout"?: TurnstileRefreshTimeout;
	"response-field"?: boolean;
	"response-field-name"?: string;
	"feedback-enabled"?: boolean;
}

export interface ProviderConfig {
	scriptId: string;
	scriptUrl: string;
	globalVar: string;
	callbackName: string;
	preconnect?: ReadonlyArray<{ href: string; crossOrigin?: boolean }>;
	scriptUrlParams?: (language?: string) => Record<string, string>;
	/**
	 * Translate the public `CaptchaProps` shape (narrowed to this provider's
	 * variant) into the options the underlying widget expects.
	 */
	buildOptions: (
		props: CaptchaProps,
		handlers: RenderHandlers,
	) => ProviderRenderOptions;
	render: (
		container: HTMLElement,
		options: ProviderRenderOptions,
	) => string | number;
	reset: (widgetId: string | number) => void;
	execute: (widgetId: string | number, container?: HTMLElement) => void;
	/** Fully unmount the widget. Falls back to `reset` if absent. */
	remove?: (widgetId: string | number, container?: HTMLElement) => void;
	getResponse: (widgetId: string | number) => string | null;
}
