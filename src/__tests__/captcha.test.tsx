import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptchaRef } from "../types";

type TurnstileApi = NonNullable<Window["turnstile"]>;
type GrecaptchaApi = NonNullable<Window["grecaptcha"]>;

// The loader and the component keep per-mount state at module scope (loaded
// script caches, callback counters), so each test gets a fresh copy of the
// source graph. React itself is externalised and stays a single instance.
async function freshCaptcha() {
	vi.resetModules();
	const { Captcha } = await import("../index");
	return Captcha;
}

const CALLBACK_PREFIXES = ["onTurnstileLoad", "onRecaptchaLoad", "onHcaptchaLoad"];

function leftoverCallbackKeys(): string[] {
	return Object.keys(window).filter((key) =>
		CALLBACK_PREFIXES.some((prefix) => key.startsWith(prefix)),
	);
}

let onScript: ((script: HTMLScriptElement) => void) | null = null;
let originalAppend: typeof document.body.appendChild;

beforeEach(() => {
	originalAppend = document.body.appendChild.bind(document.body);
	document.body.appendChild = (<T extends Node>(node: T): T => {
		const result = originalAppend(node);
		if (node instanceof HTMLScriptElement) onScript?.(node);
		return result;
	}) as typeof document.body.appendChild;
});

afterEach(() => {
	document.body.appendChild = originalAppend;
	onScript = null;
	document.body.innerHTML = "";
	document.head.innerHTML = "";
	window.turnstile = undefined;
	window.grecaptcha = undefined;
	window.hcaptcha = undefined;
	for (const key of leftoverCallbackKeys()) {
		delete (window as unknown as Record<string, unknown>)[key];
	}
});

/** Marks the freshly injected provider script as loaded (global already set). */
function loadInjectedScript(script: HTMLScriptElement) {
	script.dispatchEvent(new Event("load"));
}

/**
 * A fake grecaptcha whose render mirrors the real one's failure mode: it
 * throws when the container still holds a previous widget.
 */
function installFakeGrecaptcha() {
	const renderSpy = vi.fn((container: HTMLElement) => {
		if (container.childNodes.length > 0) {
			throw new Error("reCAPTCHA has already been rendered in this element");
		}
		container.appendChild(document.createElement("div"));
		return renderSpy.mock.calls.length - 1;
	});
	const resetSpy = vi.fn();
	window.grecaptcha = {
		render: renderSpy,
		reset: resetSpy,
		execute: vi.fn(),
		getResponse: vi.fn(() => "unused"),
	} as unknown as GrecaptchaApi;
	return { renderSpy, resetSpy };
}

function installFakeTurnstile(resetSpy = vi.fn()) {
	let widgetCallback: ((token: string) => void) | null = null;
	let currentToken: string | null = null;
	window.turnstile = {
		render: vi.fn(
			(
				_container: HTMLElement | string,
				options: { callback: (token: string) => void },
			) => {
				widgetCallback = options.callback;
				return "widget-1";
			},
		),
		reset: resetSpy,
		execute: vi.fn(),
		remove: vi.fn(),
		getResponse: vi.fn(() => currentToken),
		isExpired: vi.fn(() => false),
		ready: vi.fn(),
	} as unknown as TurnstileApi;
	return {
		resetSpy,
		fireVerify: (token: string) => {
			currentToken = token;
			widgetCallback?.(token);
		},
		waitRendered: async () => {
			await waitFor(() =>
				expect(window.turnstile?.render).toHaveBeenCalledTimes(1),
			);
		},
	};
}

function makeRef(): { current: CaptchaRef | null } {
	return { current: null };
}

describe("<Captcha> lifecycle", () => {
	it("survives a StrictMode double mount for google (teardown clears the container)", async () => {
		const Captcha = await freshCaptcha();
		const { renderSpy } = installFakeGrecaptcha();
		onScript = loadInjectedScript;
		const onError = vi.fn();
		const onVerify = vi.fn();

		// First mount loads the script through the real loader, priming the
		// module-level "already loaded" cache for the StrictMode remount below.
		const first = render(
			<Captcha provider="google" siteKey="k1" onVerify={onVerify} onError={onError} />,
		);
		await waitFor(() => expect(renderSpy).toHaveBeenCalledTimes(1));
		first.unmount();

		// The script is cached, so `isLoaded` is true on the very first render
		// and StrictMode's mount → cleanup → mount cycle renders the widget
		// twice into the same container. The fake render throws if the teardown
		// left the old widget's DOM behind.
		const second = render(
			<StrictMode>
				<Captcha provider="google" siteKey="k1" onVerify={onVerify} onError={onError} />
			</StrictMode>,
		);

		await waitFor(() => expect(renderSpy).toHaveBeenCalledTimes(3));
		expect(onError).not.toHaveBeenCalled();
		second.unmount();
	});

	it("rebuilds the widget when a render prop changes, but not on callback/className changes", async () => {
		const Captcha = await freshCaptcha();
		const { renderSpy, resetSpy } = installFakeGrecaptcha();
		onScript = loadInjectedScript;
		const onError = vi.fn();
		const onVerify = vi.fn();
		const base = { provider: "google" as const, siteKey: "k1", onVerify, onError };

		const { rerender } = render(<Captcha {...base} />);
		await waitFor(() => expect(renderSpy).toHaveBeenCalledTimes(1));

		// A new inline callback identity and a presentational change must not
		// rebuild the widget.
		rerender(<Captcha {...base} onVerify={vi.fn()} className="different" />);
		expect(renderSpy).toHaveBeenCalledTimes(1);

		rerender(<Captcha {...base} theme="dark" />);
		await waitFor(() => expect(renderSpy).toHaveBeenCalledTimes(2));
		expect(resetSpy).toHaveBeenCalled();
		expect(onError).not.toHaveBeenCalled();
	});

	it("does not throw when the provider's reset() throws", async () => {
		const Captcha = await freshCaptcha();
		const throwingReset = vi.fn(() => {
			throw new Error("boom");
		});
		const harness = installFakeTurnstile(throwingReset);
		onScript = loadInjectedScript;

		const ref = makeRef();
		render(
			<Captcha ref={ref} provider="cloudflare" siteKey="sk" onVerify={vi.fn()} />,
		);
		await harness.waitRendered();

		expect(() => ref.current?.reset()).not.toThrow();
		expect(throwingReset).toHaveBeenCalledWith("widget-1");
	});
});

describe("<Captcha> token handling", () => {
	it("getResponse() stops serving a token once execute() has delivered it", async () => {
		const Captcha = await freshCaptcha();
		const harness = installFakeTurnstile();
		onScript = loadInjectedScript;

		const ref = makeRef();
		const onVerify = vi.fn();
		render(
			<Captcha ref={ref} provider="cloudflare" siteKey="sk" onVerify={onVerify} />,
		);
		await harness.waitRendered();

		// Freshly solved, never delivered: visible to both APIs.
		harness.fireVerify("TOKEN-1");
		expect(onVerify).toHaveBeenCalledWith("TOKEN-1");
		expect(ref.current?.getResponse()).toBe("TOKEN-1");

		// execute() hands the undelivered token out immediately…
		await expect(ref.current?.execute()).resolves.toBe("TOKEN-1");
		// …and consumes it: getResponse() must not serve it a second time.
		expect(ref.current?.getResponse()).toBeNull();
	});

	it("aborting execute() rejects with AbortError and resets the widget", async () => {
		const Captcha = await freshCaptcha();
		const harness = installFakeTurnstile();
		onScript = loadInjectedScript;

		const ref = makeRef();
		render(
			<Captcha ref={ref} provider="cloudflare" siteKey="sk" onVerify={vi.fn()} />,
		);
		await harness.waitRendered();

		const controller = new AbortController();
		const promise = ref.current?.execute(controller.signal);
		controller.abort();

		await expect(promise).rejects.toMatchObject({ name: "AbortError" });
		expect(harness.resetSpy).toHaveBeenCalledWith("widget-1");
	});
});

describe("provider script hardening", () => {
	it("sets crossOrigin=anonymous on the injected provider script", async () => {
		const Captcha = await freshCaptcha();
		installFakeTurnstile();

		let injected: HTMLScriptElement | null = null;
		onScript = (script) => {
			injected = script;
			loadInjectedScript(script);
		};

		render(<Captcha provider="cloudflare" siteKey="sk" onVerify={vi.fn()} />);

		expect((injected as HTMLScriptElement | null)?.crossOrigin).toBe("anonymous");
	});

	it("refuses to adopt a same-origin script element from an unexpected path", async () => {
		const Captcha = await freshCaptcha();
		const rogue = document.createElement("script");
		rogue.id = "cf-turnstile-script";
		rogue.src = "https://challenges.cloudflare.com/not-turnstile/api.js";
		originalAppend(rogue);

		const onError = vi.fn();
		render(
			<Captcha provider="cloudflare" siteKey="sk" onVerify={vi.fn()} onError={onError} />,
		);

		await waitFor(() => expect(onError).toHaveBeenCalled());
		expect(onError.mock.calls[0][0].message).toMatch(/Refusing to trust/);
	});
});
