import type {
	CaptchaProps,
	HCaptchaCaptchaProps,
	ProviderConfig,
	ProviderRenderOptions,
	RenderHandlers,
} from "../types";

function buildOptions(
	props: CaptchaProps,
	handlers: RenderHandlers,
): ProviderRenderOptions {
	if (props.provider !== "hcaptcha") {
		throw new Error("hcaptchaProvider.buildOptions: wrong provider");
	}
	const p = props as HCaptchaCaptchaProps;

	const options: ProviderRenderOptions = {
		sitekey: p.siteKey,
		callback: handlers.onVerify,
		"error-callback": handlers.onError,
		"expired-callback": handlers.onExpire,
		// hCaptcha only supports light/dark.
		theme: p.theme === "auto" ? undefined : p.theme,
		size: p.size,
		tabindex: p.tabIndex,
	};

	// hCaptcha is reCAPTCHA-compatible: use `hl`, not `language`.
	if (p.language) options.hl = p.language;
	if (p.onChallengeExpired)
		options["chalexpired-callback"] = p.onChallengeExpired;
	if (p.onOpen) options["open-callback"] = p.onOpen;
	if (p.onClose) options["close-callback"] = p.onClose;

	return options;
}

export const hcaptchaProvider: ProviderConfig = {
	scriptId: "hcaptcha-script",
	scriptUrl: "https://js.hcaptcha.com/1/api.js",
	globalVar: "hcaptcha",
	callbackName: "onHcaptchaLoad",

	buildOptions,

	render(container, options) {
		if (!window.hcaptcha) {
			throw new Error("hCaptcha not loaded");
		}
		return window.hcaptcha.render(container, options);
	},

	reset(widgetId) {
		if (window.hcaptcha && typeof widgetId === "string") {
			window.hcaptcha.reset(widgetId);
		}
	},

	execute(widgetId) {
		if (window.hcaptcha && typeof widgetId === "string") {
			window.hcaptcha.execute(widgetId);
		}
	},

	remove(widgetId) {
		if (
			window.hcaptcha &&
			typeof widgetId === "string" &&
			typeof window.hcaptcha.remove === "function"
		) {
			window.hcaptcha.remove(widgetId);
		}
	},

	getResponse(widgetId) {
		if (window.hcaptcha && typeof widgetId === "string") {
			return window.hcaptcha.getResponse(widgetId) || null;
		}
		return null;
	},
};
