import type { ProviderConfig, ProviderRenderOptions } from "../types";

export const hcaptchaProvider: ProviderConfig = {
	scriptId: "hcaptcha-script",
	scriptUrl: "https://js.hcaptcha.com/1/api.js",
	globalVar: "hcaptcha",
	callbackName: "onHcaptchaLoad",

	render(container: HTMLElement, options: ProviderRenderOptions) {
		if (!window.hcaptcha) {
			throw new Error("hCaptcha not loaded");
		}
		return window.hcaptcha.render(container, options);
	},

	reset(widgetId: string | number) {
		if (window.hcaptcha && typeof widgetId === "string") {
			window.hcaptcha.reset(widgetId);
		}
	},

	execute(widgetId: string | number) {
		if (window.hcaptcha && typeof widgetId === "string") {
			window.hcaptcha.execute(widgetId);
		}
	},

	getResponse(widgetId: string | number) {
		if (window.hcaptcha && typeof widgetId === "string") {
			return window.hcaptcha.getResponse(widgetId) || null;
		}
		return null;
	},
};
