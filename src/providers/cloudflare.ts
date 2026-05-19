import type {
	CaptchaProps,
	ProviderConfig,
	ProviderRenderOptions,
	RenderHandlers,
	TurnstileCaptchaProps,
} from "../types";

function buildOptions(
	props: CaptchaProps,
	handlers: RenderHandlers,
): ProviderRenderOptions {
	if (props.provider !== "cloudflare") {
		throw new Error("cloudflareProvider.buildOptions: wrong provider");
	}
	const p = props as TurnstileCaptchaProps;

	const options: ProviderRenderOptions = {
		sitekey: p.siteKey,
		callback: handlers.onVerify,
		"error-callback": handlers.onError,
		"expired-callback": handlers.onExpire,
		// Turnstile accepts `auto` natively (and uses it as default).
		theme: p.theme,
		size: p.size,
		tabindex: p.tabIndex,
	};

	if (p.language) options.language = p.language;
	if (p.action !== undefined) options.action = p.action;
	if (p.cData !== undefined) options.cData = p.cData;
	if (p.appearance !== undefined) options.appearance = p.appearance;
	if (p.execution !== undefined) options.execution = p.execution;
	if (p.retry !== undefined) options.retry = p.retry;
	if (p.retryInterval !== undefined) options["retry-interval"] = p.retryInterval;
	if (p.refreshExpired !== undefined)
		options["refresh-expired"] = p.refreshExpired;
	if (p.refreshTimeout !== undefined)
		options["refresh-timeout"] = p.refreshTimeout;
	if (p.responseField !== undefined) options["response-field"] = p.responseField;
	if (p.responseFieldName !== undefined)
		options["response-field-name"] = p.responseFieldName;
	if (p.feedbackEnabled !== undefined)
		options["feedback-enabled"] = p.feedbackEnabled;
	if (p.onTimeout) options["timeout-callback"] = p.onTimeout;
	if (p.onBeforeInteractive)
		options["before-interactive-callback"] = p.onBeforeInteractive;
	if (p.onAfterInteractive)
		options["after-interactive-callback"] = p.onAfterInteractive;
	if (p.onUnsupported) options["unsupported-callback"] = p.onUnsupported;

	return options;
}

export const cloudflareProvider: ProviderConfig = {
	scriptId: "cf-turnstile-script",
	scriptUrl: "https://challenges.cloudflare.com/turnstile/v0/api.js",
	globalVar: "turnstile",
	callbackName: "onTurnstileLoad",
	preconnect: [{ href: "https://challenges.cloudflare.com" }],

	scriptUrlParams() {
		// Turnstile reads `language` from render options, not the script URL.
		return {};
	},

	buildOptions,

	render(container, options) {
		if (!window.turnstile) {
			throw new Error("Cloudflare Turnstile not loaded");
		}
		return window.turnstile.render(container, options);
	},

	reset(widgetId) {
		if (window.turnstile && typeof widgetId === "string") {
			window.turnstile.reset(widgetId);
		}
	},

	execute(_widgetId, container) {
		// Turnstile's execute() takes the container (or selector), not the widget id.
		// Only meaningful when the widget was rendered with `execution: "execute"`.
		if (window.turnstile && container) {
			window.turnstile.execute(container);
		}
	},

	remove(widgetId) {
		if (window.turnstile && typeof widgetId === "string") {
			window.turnstile.remove(widgetId);
		}
	},

	getResponse(widgetId) {
		if (window.turnstile && typeof widgetId === "string") {
			return window.turnstile.getResponse(widgetId) ?? null;
		}
		return null;
	},
};
