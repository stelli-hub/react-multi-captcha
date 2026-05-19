# react-multi-captcha

A lightweight React component supporting multiple captcha providers: Google reCAPTCHA, hCaptcha, and Cloudflare Turnstile.

## Features

- Support for Google reCAPTCHA v2, hCaptcha, and Cloudflare Turnstile
- TypeScript support with full type definitions
- Discriminated-union props — provider-specific options are only valid for that provider
- Ref API for programmatic control (`reset`, `execute(signal?)`, `getResponse`)
- Automatic script loading with deduplication and preconnect hints
- Latest-callback semantics — parent updates to `onVerify` / `onError` etc. take effect immediately
- Live prop reconciliation — changing `siteKey`, `theme`, `size`, etc. rebuilds the widget
- Zero runtime dependencies
- Works with React 18 and React 19

## Installation

```bash
npm install react-multi-captcha
# or
pnpm add react-multi-captcha
# or
yarn add react-multi-captcha
```

## Usage

### Basic Usage

```tsx
import { Captcha } from "react-multi-captcha";

function LoginForm() {
  const handleVerify = (token: string) => {
    console.log("Captcha verified:", token);
  };

  return (
    <Captcha
      provider="google"
      siteKey="your-site-key"
      onVerify={handleVerify}
    />
  );
}
```

### With Ref for Programmatic Control

```tsx
import { useRef } from "react";
import { Captcha, CaptchaRef } from "react-multi-captcha";

function Form() {
  const captchaRef = useRef<CaptchaRef>(null);

  const handleSubmit = async () => {
    // Get current response
    const token = captchaRef.current?.getResponse();

    if (!token) {
      // Execute invisible captcha
      const newToken = await captchaRef.current?.execute();
    }

    // Submit form...
  };

  const handleReset = () => {
    captchaRef.current?.reset();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Captcha
        ref={captchaRef}
        provider="hcaptcha"
        siteKey="your-site-key"
        onVerify={(token) => console.log(token)}
      />
      <button type="button" onClick={handleReset}>
        Reset Captcha
      </button>
      <button type="submit">Submit</button>
    </form>
  );
}
```

### With All Options

```tsx
import { Captcha } from "react-multi-captcha";

function Form() {
  return (
    <Captcha
      provider="cloudflare"
      siteKey="your-site-key"
      onVerify={(token) => console.log("Verified:", token)}
      onError={(error) => console.error("Error:", error)}
      onExpire={() => console.log("Token expired")}
      onLoad={() => console.log("Captcha loaded")}
      theme="dark"
      size="normal"
      language="pt-BR"
      tabIndex={0}
      className="my-captcha"
      style={{ marginTop: "1rem" }}
    />
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `provider` | `"google" \| "hcaptcha" \| "cloudflare"` | Yes | - | Captcha provider to use |
| `siteKey` | `string` | Yes | - | Site key from the captcha provider |
| `onVerify` | `(token: string) => void` | Yes | - | Callback when verification succeeds |
| `onError` | `(error: Error) => void` | No | - | Callback when an error occurs |
| `onExpire` | `() => void` | No | - | Callback when the token expires |
| `onLoad` | `() => void` | No | - | Callback when the widget loads |
| `theme` | `"light" \| "dark" \| "auto"` | No | `"light"` | Widget theme. Only Cloudflare Turnstile supports `auto`; reCAPTCHA and hCaptcha fall back to `light`. |
| `size` | varies by provider — see below | No | `"normal"` | Widget size |
| `language` | `string` | No | - | Language code (e.g., "en", "pt-BR") |
| `tabIndex` | `number` | No | - | Tab index for accessibility |
| `className` | `string` | No | - | Additional CSS class names |
| `style` | `CSSProperties` | No | - | Inline styles for the container |

### `size` by provider

| Provider     | Allowed values                       |
|--------------|---------------------------------------|
| `google`     | `normal` \| `compact` \| `invisible`  |
| `hcaptcha`   | `normal` \| `compact` \| `invisible`  |
| `cloudflare` | `normal` \| `compact` \| `flexible`   |

`invisible` for Turnstile is configured at sitekey creation in the Cloudflare dashboard, not via this prop.

### Cloudflare Turnstile — additional props

Only valid when `provider="cloudflare"`. All optional.

| Prop | Type | Description |
|------|------|-------------|
| `action` | `string` | Analytics identifier (≤32 chars; alphanumeric + `_` `-`). |
| `cData` | `string` | Custom payload returned during siteverify (≤255 chars; alphanumeric + `_` `-`). |
| `appearance` | `"always" \| "execute" \| "interaction-only"` | When the widget is visible. |
| `execution` | `"render" \| "execute"` | When the challenge runs. With `execute`, call `ref.execute()` to start. |
| `retry` | `"auto" \| "never"` | Auto-retry on failure. |
| `retryInterval` | `number` | Ms between retries (default 8000, max 900000). |
| `refreshExpired` | `"auto" \| "manual" \| "never"` | Behavior on token expiry. |
| `refreshTimeout` | `"auto" \| "manual" \| "never"` | Behavior on interactive timeout (Managed mode). |
| `responseField` | `boolean` | Create the hidden form input (default `true`). |
| `responseFieldName` | `string` | Hidden input name (default `cf-turnstile-response`). |
| `feedbackEnabled` | `boolean` | Allow Cloudflare to gather visitor feedback (default `true`). |
| `onTimeout` | `() => void` | Interactive challenge timed out. |
| `onBeforeInteractive` | `() => void` | About to enter interactive mode. |
| `onAfterInteractive` | `() => void` | Left interactive mode. |
| `onUnsupported` | `() => void` | Browser not supported by Turnstile. |

### Google reCAPTCHA — additional props

Only valid when `provider="google"`. All optional.

| Prop | Type | Description |
|------|------|-------------|
| `badge` | `"bottomright" \| "bottomleft" \| "inline"` | Reposition the reCAPTCHA badge (invisible reCAPTCHA only). Default `bottomright`. Use `inline` to position via CSS. |

### hCaptcha — additional props

Only valid when `provider="hcaptcha"`. All optional.

| Prop | Type | Description |
|------|------|-------------|
| `onChallengeExpired` | `() => void` | The on-screen challenge timed out before the user answered. |
| `onOpen` | `() => void` | A challenge dialog opened. |
| `onClose` | `() => void` | The user dismissed the challenge. |

## Ref Methods

| Method | Type | Description |
|--------|------|-------------|
| `reset` | `() => void` | Reset the captcha widget |
| `execute` | `(signal?: AbortSignal) => Promise<string>` | Execute the captcha (invisible reCAPTCHA/hCaptcha, or Turnstile `execution: "execute"`). Pass an `AbortSignal` to cancel — composes naturally with `AbortSignal.timeout(ms)`. |
| `getResponse` | `() => string \| null` | Get the current response token |

### Behavior notes

- Callbacks are always invoked at their latest reference — you can pass inline arrows for `onVerify` / `onError` / `onExpire` without losing updates after the widget mounts.
- Changing `siteKey`, `theme`, `size`, `language`, or any provider-specific render prop after mount tears down the widget and renders it fresh against the new config.
- If the provider's script fails to load, the component still renders an empty container and reports the failure through `onError`. Remount or change props to retry — the failure is not cached.
- `execute(signal?)` accepts an optional `AbortSignal`. Combine with `AbortSignal.timeout(ms)` to time out the verification:

  ```ts
  const token = await ref.current?.execute(AbortSignal.timeout(10_000));
  ```

## Provider-Specific Notes

### Google reCAPTCHA

- Supports reCAPTCHA **v2** — both the visible "I'm not a robot" checkbox and the invisible badge (`size="invisible"`)
- reCAPTCHA **v3** (score-based, no widget) is not supported by this component; it uses a different API surface
- Get your site key from [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
- `theme="auto"` is not supported and falls back to `light`
- Preconnect hints for `https://www.google.com` and `https://www.gstatic.com` are injected automatically

### hCaptcha

- Privacy-focused alternative to reCAPTCHA
- Get your site key from [hCaptcha Dashboard](https://dashboard.hcaptcha.com/)

### Cloudflare Turnstile

- Non-interactive, privacy-preserving captcha
- Get your site key from [Cloudflare Dashboard](https://dash.cloudflare.com/)
- Server-side validation against the Siteverify API is **required** — tokens are single-use and expire after 5 minutes
- `<link rel="preconnect" href="https://challenges.cloudflare.com">` is injected automatically to speed up the handshake
- Testing sitekeys (always-pass / always-block) are documented at [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)

```tsx
<Captcha
  provider="cloudflare"
  siteKey="your-site-key"
  size="flexible"
  appearance="interaction-only"
  action="login"
  cData="session-123"
  execution="execute"
  refreshExpired="auto"
  onVerify={(token) => console.log(token)}
  onTimeout={() => console.warn("interactive timeout")}
/>
```

## License

MIT
