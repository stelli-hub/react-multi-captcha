import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TurnstileApi = NonNullable<Window["turnstile"]>;

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const CALLBACK_PREFIX = "onTurnstileLoad";

// The loader keeps its "already loaded" caches at module scope, so every test
// needs a fresh copy of the source graph. Only `src/**` is reset — React itself
// is externalised and stays a single instance across tests.
async function freshCaptcha() {
	vi.resetModules();
	const { Captcha } = await import("../index");
	return Captcha;
}

function leftoverCallbackKeys(): string[] {
	return Object.keys(window).filter((key) => key.startsWith(CALLBACK_PREFIX));
}

function onloadNameOf(script: HTMLScriptElement): string {
	const name = new URL(script.src).searchParams.get("onload");
	if (!name) throw new Error(`No ?onload= in script src: ${script.src}`);
	return name;
}

function makeRenderFn(): TurnstileApi["render"] {
	return () => "widget-1";
}

function tick(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
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
	for (const key of leftoverCallbackKeys()) {
		delete (window as unknown as Record<string, unknown>)[key];
	}
});

interface Harness {
	onLoad: ReturnType<typeof vi.fn>;
	onError: ReturnType<typeof vi.fn>;
	onVerify: ReturnType<typeof vi.fn>;
	unmount: () => void;
}

async function mountCaptcha(): Promise<Harness> {
	const Captcha = await freshCaptcha();
	const onLoad = vi.fn();
	const onError = vi.fn();
	const onVerify = vi.fn();
	const { unmount } = render(
		<Captcha
			provider="cloudflare"
			siteKey="test-site-key"
			onVerify={onVerify}
			onLoad={onLoad}
			onError={onError}
		/>,
	);
	return { onLoad, onError, onVerify, unmount };
}

describe("provider script loading", () => {
	it("keeps the ?onload= callback reachable until the provider invokes it", async () => {
		let callbackTypeAtInit: string | null = null;
		let onloadName = "";

		onScript = (script) => {
			onloadName = onloadNameOf(script);
			// A complete API is already on `window` when the tag finishes
			// executing, so the polling path settles the load first.
			window.turnstile = { render: makeRenderFn() } as TurnstileApi;
			script.dispatchEvent(new Event("load"));

			// The provider only reaches for its callback after its own async init.
			setTimeout(() => {
				const w = window as unknown as Record<string, unknown>;
				callbackTypeAtInit = typeof w[onloadName];
				if (typeof w[onloadName] === "function") {
					(w[onloadName] as () => void)();
				}
			}, 60);
		};

		const { onLoad, onError } = await mountCaptcha();

		await waitFor(() => expect(onLoad).toHaveBeenCalled());
		await tick(120);

		expect(callbackTypeAtInit).toBe("function");
		expect(onLoad).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
		expect(leftoverCallbackKeys()).toEqual([]);
		expect(onloadName.startsWith(`${CALLBACK_PREFIX}_`)).toBe(true);
	});

	it("waits for the API to be usable, not merely present", async () => {
		let renderTypeAtOnLoad: string | undefined;
		const renderSpy = vi.fn(makeRenderFn());

		onScript = (script) => {
			const onloadName = onloadNameOf(script);
			// api.js assigns the global as a bare stub while it evaluates; `render`
			// is attached only once the provider finishes initialising.
			window.turnstile = {} as TurnstileApi;
			script.dispatchEvent(new Event("load"));

			setTimeout(() => {
				const api = window.turnstile as TurnstileApi;
				api.render = renderSpy;
				const w = window as unknown as Record<string, unknown>;
				(w[onloadName] as () => void)();
			}, 120);
		};

		const { onLoad, onError } = await mountCaptcha();
		onLoad.mockImplementation(() => {
			renderTypeAtOnLoad = typeof window.turnstile?.render;
		});

		await waitFor(() => expect(onLoad).toHaveBeenCalled(), { timeout: 2000 });

		expect(renderTypeAtOnLoad).toBe("function");
		expect(renderSpy).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
		expect(leftoverCallbackKeys()).toEqual([]);
	});

	it("removes the callback when the script fails to load", async () => {
		onScript = (script) => {
			script.dispatchEvent(new Event("error"));
		};

		const { onError } = await mountCaptcha();

		await waitFor(() => expect(onError).toHaveBeenCalled());
		expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
		expect(leftoverCallbackKeys()).toEqual([]);
	});

	it("does not revoke a callback owned by an in-flight load", async () => {
		const w = window as unknown as Record<string, unknown>;
		const inFlightCallback = vi.fn();
		w[`${CALLBACK_PREFIX}_99`] = inFlightCallback;

		const existing = document.createElement("script");
		existing.id = SCRIPT_ID;
		existing.src = `${SCRIPT_URL}?onload=${CALLBACK_PREFIX}_99&render=explicit`;
		originalAppend(existing);

		setTimeout(() => {
			window.turnstile = { render: makeRenderFn() } as TurnstileApi;
		}, 60);

		const { onLoad, onError } = await mountCaptcha();

		await waitFor(() => expect(onLoad).toHaveBeenCalled(), { timeout: 2000 });

		expect(onError).not.toHaveBeenCalled();
		expect(typeof w[`${CALLBACK_PREFIX}_99`]).toBe("function");
		expect(inFlightCallback).not.toHaveBeenCalled();
		expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
	});
});
