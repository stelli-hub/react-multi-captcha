import { StrictMode, useRef, useState } from "react";
import { Captcha } from "react-multi-captcha";
import type {
	CaptchaProps,
	CaptchaProvider,
	CaptchaRef,
} from "react-multi-captcha";

// Provider test sitekeys (always pass).
// Turnstile: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
// hCaptcha:  https://docs.hcaptcha.com/#integration-testing-test-keys
// reCAPTCHA: Google's documented automated-test key (returns success)
const TEST_SITEKEYS: Record<CaptchaProvider, { label: string; key: string }[]> =
	{
		cloudflare: [
			{ label: "Always-pass (visible)", key: "1x00000000000000000000AA" },
			{ label: "Always-block (visible)", key: "2x00000000000000000000AA" },
			{ label: "Force interactive", key: "3x00000000000000000000FF" },
			{ label: "Always-pass (invisible)", key: "1x00000000000000000000BB" },
		],
		hcaptcha: [
			{
				label: "Always-pass (Publisher)",
				key: "10000000-ffff-ffff-ffff-000000000001",
			},
		],
		google: [
			{
				label: "Demo (always-success)",
				key: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
			},
		],
	};

type Theme = "light" | "dark" | "auto";

export function App() {
	const [provider, setProvider] = useState<CaptchaProvider>("cloudflare");
	const [siteKey, setSiteKey] = useState(
		TEST_SITEKEYS.cloudflare[0].key,
	);
	const [theme, setTheme] = useState<Theme>("auto");
	const [size, setSize] = useState<string>("normal");
	const [mounted, setMounted] = useState(true);
	const [strict, setStrict] = useState(false);
	const [twin, setTwin] = useState(false);
	const [bumpKey, setBumpKey] = useState(0);
	const [verifyCounter, setVerifyCounter] = useState(0);
	const [token, setToken] = useState<string | null>(null);
	const [log, setLog] = useState<{ at: number; msg: string }[]>([]);

	const ref = useRef<CaptchaRef>(null);

	const appendLog = (msg: string) =>
		setLog((prev) => [...prev.slice(-99), { at: Date.now(), msg }]);

	// Inline arrows on purpose: each render produces a new closure. The
	// latest-callback fix means the freshest closure runs when the widget
	// finally fires `onVerify`. The counter value in the message proves it.
	const onVerify = (t: string) => {
		setToken(t);
		appendLog(
			`onVerify fired (counter at fire-time = ${verifyCounter}); token len ${t.length}`,
		);
	};
	const onError = (err: Error) =>
		appendLog(`onError: ${err.name}: ${err.message}`);
	const onExpire = () => appendLog("onExpire");
	const onLoad = () => appendLog(`script loaded for ${provider}`);

	const captchaProps: CaptchaProps = buildProps({
		provider,
		siteKey,
		theme,
		size,
		onVerify,
		onError,
		onExpire,
		onLoad,
	});

	const widget = (
		<Captcha
			ref={ref}
			{...captchaProps}
			// `key` forces remount, used by the "Force remount" button.
			key={bumpKey}
		/>
	);

	const widgetTree = strict ? <StrictMode>{widget}</StrictMode> : widget;

	const handleExecute = async (timeoutMs?: number) => {
		if (!ref.current) return;
		try {
			const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
			const t = await ref.current.execute(signal);
			appendLog(`execute() resolved, token len ${t.length}`);
		} catch (err) {
			const e = err as Error;
			appendLog(`execute() rejected: ${e.name}: ${e.message}`);
		}
	};

	return (
		<div
			style={{
				fontFamily: "system-ui, sans-serif",
				maxWidth: 880,
				margin: "32px auto",
				padding: "0 16px",
				color: "#222",
			}}
		>
			<h1 style={{ margin: 0, fontSize: 22 }}>react-multi-captcha · demo</h1>
			<p style={{ color: "#666", marginTop: 4 }}>
				Source: <code>../src</code> · use the panels to exercise the refactor.
			</p>

			<section style={panel}>
				<h2 style={h2}>1. Config</h2>
				<Row label="Provider">
					{(["cloudflare", "hcaptcha", "google"] as const).map((p) => (
						<button
							key={p}
							onClick={() => {
								setProvider(p);
								setSiteKey(TEST_SITEKEYS[p][0].key);
								setToken(null);
							}}
							style={pill(provider === p)}
						>
							{p}
						</button>
					))}
				</Row>
				<Row label="Sitekey">
					<select
						value={siteKey}
						onChange={(e) => {
							setSiteKey(e.target.value);
							setToken(null);
						}}
						style={{ padding: 6, minWidth: 360 }}
					>
						{TEST_SITEKEYS[provider].map((k) => (
							<option key={k.key} value={k.key}>
								{k.label} — {k.key}
							</option>
						))}
					</select>
				</Row>
				<Row label="Theme">
					{(["light", "dark", "auto"] as const).map((t) => (
						<button
							key={t}
							onClick={() => setTheme(t)}
							style={pill(theme === t)}
						>
							{t}
						</button>
					))}
				</Row>
				<Row label="Size">
					{validSizes(provider).map((s) => (
						<button key={s} onClick={() => setSize(s)} style={pill(size === s)}>
							{s}
						</button>
					))}
				</Row>
			</section>

			<section style={panel}>
				<h2 style={h2}>2. Lifecycle</h2>
				<Row label="Mount">
					<button onClick={() => setMounted((m) => !m)} style={pill(mounted)}>
						{mounted ? "mounted (click to unmount)" : "unmounted (click to mount)"}
					</button>
					<button onClick={() => setBumpKey((k) => k + 1)} style={pill(false)}>
						Force remount (key++)
					</button>
				</Row>
				<Row label="StrictMode">
					<button onClick={() => setStrict((s) => !s)} style={pill(strict)}>
						{strict ? "on" : "off"}
					</button>
					<small style={{ color: "#666" }}>
						In dev React mounts effects twice; widget should still render once.
					</small>
				</Row>
				<Row label="Twin instance">
					<button onClick={() => setTwin((t) => !t)} style={pill(twin)}>
						{twin ? "showing two widgets" : "show second instance"}
					</button>
					<small style={{ color: "#666" }}>
						Network tab should show api.js fetched only once.
					</small>
				</Row>
			</section>

			<section style={panel}>
				<h2 style={h2}>3. Latest-callback test</h2>
				<Row label="Verify counter">
					<button
						onClick={() => setVerifyCounter((c) => c + 1)}
						style={pill(false)}
					>
						verifyCounter++ ({verifyCounter})
					</button>
					<small style={{ color: "#666" }}>
						Bump this, then solve the captcha — the log should show the latest
						counter, proving the parent's fresh inline arrow ran.
					</small>
				</Row>
			</section>

			<section style={panel}>
				<h2 style={h2}>4. Imperative ref</h2>
				<Row label="Controls">
					<button onClick={() => ref.current?.reset()} style={pill(false)}>
						reset()
					</button>
					<button
						onClick={() => {
							const r = ref.current?.getResponse() ?? null;
							appendLog(`getResponse() = ${r ? `len ${r.length}` : "null"}`);
						}}
						style={pill(false)}
					>
						getResponse()
					</button>
					<button onClick={() => handleExecute()} style={pill(false)}>
						execute()
					</button>
					<button onClick={() => handleExecute(500)} style={pill(false)}>
						execute(AbortSignal.timeout(500))
					</button>
				</Row>
			</section>

			<section style={panel}>
				<h2 style={h2}>5. Widget</h2>
				<div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
					{mounted && (
						<div style={widgetBox}>
							<small style={subtle}>primary instance</small>
							{widgetTree}
						</div>
					)}
					{twin && (
						<div style={widgetBox}>
							<small style={subtle}>twin instance (shares the script)</small>
							<Captcha {...captchaProps} />
						</div>
					)}
				</div>
			</section>

			<section style={panel}>
				<h2 style={h2}>6. State</h2>
				<Row label="Last token">
					<code style={tokenStyle}>{token ?? "(none)"}</code>
				</Row>
			</section>

			<section style={panel}>
				<h2 style={h2}>7. Event log</h2>
				<button
					onClick={() => setLog([])}
					style={{ ...pill(false), marginBottom: 8 }}
				>
					Clear
				</button>
				<div
					style={{
						fontFamily: "ui-monospace, SFMono-Regular, monospace",
						fontSize: 12,
						maxHeight: 280,
						overflow: "auto",
						background: "#0f172a",
						color: "#e2e8f0",
						padding: 12,
						borderRadius: 6,
					}}
				>
					{log.length === 0 ? (
						<div style={{ color: "#94a3b8" }}>(no events yet)</div>
					) : (
						log
							.slice()
							.reverse()
							.map((entry, i) => (
								<div key={i}>
									<span style={{ color: "#64748b" }}>
										{new Date(entry.at).toISOString().substr(11, 12)}
									</span>{" "}
									{entry.msg}
								</div>
							))
					)}
				</div>
			</section>

			<details style={{ marginTop: 16, color: "#666" }}>
				<summary>Notes</summary>
				<ul>
					<li>
						hCaptcha refuses to render on <code>localhost</code> / IP literals.
						Add <code>127.0.0.1 test.localhost</code> to <code>/etc/hosts</code>{" "}
						and serve from <code>http://test.localhost:5173</code> if you need
						to exercise it.
					</li>
					<li>
						Turnstile and reCAPTCHA's demo sitekeys work on{" "}
						<code>localhost</code> directly.
					</li>
					<li>
						The "Twin instance" toggle proves the loader deduplicates: the
						second mount should not refetch <code>api.js</code>.
					</li>
				</ul>
			</details>
		</div>
	);
}

function buildProps(args: {
	provider: CaptchaProvider;
	siteKey: string;
	theme: Theme;
	size: string;
	onVerify: (t: string) => void;
	onError: (err: Error) => void;
	onExpire: () => void;
	onLoad: () => void;
}): CaptchaProps {
	const { provider, siteKey, theme, size, onVerify, onError, onExpire, onLoad } =
		args;
	const common = { siteKey, theme, onVerify, onError, onExpire, onLoad };
	switch (provider) {
		case "cloudflare":
			return {
				...common,
				provider: "cloudflare",
				size: size as "normal" | "compact" | "flexible",
			};
		case "hcaptcha":
			return {
				...common,
				provider: "hcaptcha",
				size: size as "normal" | "compact" | "invisible",
			};
		case "google":
			return {
				...common,
				provider: "google",
				size: size as "normal" | "compact" | "invisible",
			};
	}
}

function validSizes(provider: CaptchaProvider): string[] {
	if (provider === "cloudflare") return ["normal", "compact", "flexible"];
	return ["normal", "compact", "invisible"];
}

// ----- styles -----

const panel: React.CSSProperties = {
	background: "#fff",
	border: "1px solid #e5e7eb",
	borderRadius: 8,
	padding: 16,
	marginTop: 12,
};

const h2: React.CSSProperties = {
	margin: 0,
	marginBottom: 8,
	fontSize: 14,
	color: "#475569",
	textTransform: "uppercase",
	letterSpacing: 0.5,
};

const widgetBox: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
};

const subtle: React.CSSProperties = {
	color: "#64748b",
	fontSize: 11,
	textTransform: "uppercase",
	letterSpacing: 0.5,
};

const tokenStyle: React.CSSProperties = {
	background: "#f1f5f9",
	padding: "4px 8px",
	borderRadius: 4,
	fontSize: 11,
	wordBreak: "break-all",
	display: "inline-block",
	maxWidth: "100%",
};

function pill(active: boolean): React.CSSProperties {
	return {
		padding: "4px 10px",
		borderRadius: 999,
		border: "1px solid",
		borderColor: active ? "#2563eb" : "#cbd5e1",
		background: active ? "#dbeafe" : "#fff",
		color: active ? "#1d4ed8" : "#334155",
		cursor: "pointer",
		marginRight: 6,
		fontSize: 13,
	};
}

function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				margin: "6px 0",
				flexWrap: "wrap",
			}}
		>
			<div style={{ width: 130, color: "#475569", fontSize: 13 }}>{label}</div>
			<div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
				{children}
			</div>
		</div>
	);
}
