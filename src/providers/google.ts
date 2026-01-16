import type { ProviderConfig, ProviderRenderOptions } from "../types";

export const googleProvider: ProviderConfig = {
	scriptId: "recaptcha-script",
	scriptUrl: "https://www.google.com/recaptcha/api.js",
	globalVar: "grecaptcha",
	callbackName: "onRecaptchaLoad",

	render(container: HTMLElement, options: ProviderRenderOptions) {
		if (!window.grecaptcha) {
			throw new Error("Google reCAPTCHA not loaded");
		}
		return window.grecaptcha.render(container, options);
	},

	reset(widgetId: string | number) {
		if (window.grecaptcha && typeof widgetId === "number") {
			window.grecaptcha.reset(widgetId);
		}
	},

	execute(widgetId: string | number) {
		if (window.grecaptcha && typeof widgetId === "number") {
			window.grecaptcha.execute(widgetId);
		}
	},

	getResponse(widgetId: string | number) {
		if (window.grecaptcha && typeof widgetId === "number") {
			return window.grecaptcha.getResponse(widgetId) || null;
		}
		return null;
	},
};
