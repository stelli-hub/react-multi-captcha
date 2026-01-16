import type { CaptchaProvider, ProviderConfig } from "../types";
import { cloudflareProvider } from "./cloudflare";
import { googleProvider } from "./google";
import { hcaptchaProvider } from "./hcaptcha";

export const providers: Record<CaptchaProvider, ProviderConfig> = {
	google: googleProvider,
	hcaptcha: hcaptchaProvider,
	cloudflare: cloudflareProvider,
};

export function getProvider(name: CaptchaProvider): ProviderConfig {
	const provider = providers[name];
	if (!provider) {
		throw new Error(`Unknown captcha provider: ${name}`);
	}
	return provider;
}

export { googleProvider, hcaptchaProvider, cloudflareProvider };
