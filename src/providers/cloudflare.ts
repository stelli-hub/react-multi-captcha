import type { ProviderConfig, ProviderRenderOptions } from "../types";

export const cloudflareProvider: ProviderConfig = {
	scriptId: "cf-turnstile-script",
	scriptUrl: "https://challenges.cloudflare.com/turnstile/v0/api.js",
	globalVar: "turnstile",
	callbackName: "onTurnstileLoad",

	render(container: HTMLElement, options: ProviderRenderOptions) {
		if (!window.turnstile) {
			throw new Error("Cloudflare Turnstile not loaded");
		}
		return window.turnstile.render(container, options);
	},

	reset(widgetId: string | number) {
		if (window.turnstile && typeof widgetId === "string") {
			window.turnstile.reset(widgetId);
		}
	},

	execute(widgetId: string | number) {
		// Turnstile auto-executes, this is a no-op for non-invisible mode
		void widgetId;
	},

	getResponse(widgetId: string | number) {
		if (window.turnstile && typeof widgetId === "string") {
			return window.turnstile.getResponse(widgetId) ?? null;
		}
		return null;
	},
};
