import type {
	CaptchaProps,
	GoogleCaptchaProps,
	ProviderConfig,
	ProviderRenderOptions,
	RenderHandlers,
} from "../types";

function buildOptions(
	props: CaptchaProps,
	handlers: RenderHandlers,
): ProviderRenderOptions {
	if (props.provider !== "google") {
		throw new Error("googleProvider.buildOptions: wrong provider");
	}
	const p = props as GoogleCaptchaProps;

	const options: ProviderRenderOptions = {
		sitekey: p.siteKey,
		callback: handlers.onVerify,
		"error-callback": handlers.onError,
		"expired-callback": handlers.onExpire,
		// reCAPTCHA only supports light/dark. Collapse `auto` to undefined (=> light).
		theme: p.theme === "auto" ? undefined : p.theme,
		size: p.size,
		tabindex: p.tabIndex,
	};

	if (p.language) options.hl = p.language;
	if (p.badge !== undefined) options.badge = p.badge;

	return options;
}

export const googleProvider: ProviderConfig = {
	scriptId: "recaptcha-script",
	scriptUrl: "https://www.google.com/recaptcha/api.js",
	globalVar: "grecaptcha",
	callbackName: "onRecaptchaLoad",
	preconnect: [
		{ href: "https://www.google.com" },
		{ href: "https://www.gstatic.com", crossOrigin: true },
	],

	scriptUrlParams(language): Record<string, string> {
		return language ? { hl: language } : {};
	},

	buildOptions,

	render(container, options) {
		if (!window.grecaptcha) {
			throw new Error("Google reCAPTCHA not loaded");
		}
		return window.grecaptcha.render(container, options);
	},

	reset(widgetId) {
		if (window.grecaptcha && typeof widgetId === "number") {
			window.grecaptcha.reset(widgetId);
		}
	},

	execute(widgetId) {
		if (window.grecaptcha && typeof widgetId === "number") {
			window.grecaptcha.execute(widgetId);
		}
	},

	getResponse(widgetId) {
		if (window.grecaptcha && typeof widgetId === "number") {
			return window.grecaptcha.getResponse(widgetId) || null;
		}
		return null;
	},
};
