# react-multi-captcha

A lightweight React component supporting multiple captcha providers: Google reCAPTCHA, hCaptcha, and Cloudflare Turnstile.

## Features

- Support for Google reCAPTCHA v2, hCaptcha, and Cloudflare Turnstile
- TypeScript support with full type definitions
- Ref API for programmatic control (reset, execute, getResponse)
- Automatic script loading with deduplication
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
| `theme` | `"light" \| "dark" \| "auto"` | No | `"light"` | Widget theme |
| `size` | `"normal" \| "compact" \| "invisible"` | No | `"normal"` | Widget size |
| `language` | `string` | No | - | Language code (e.g., "en", "pt-BR") |
| `tabIndex` | `number` | No | - | Tab index for accessibility |
| `className` | `string` | No | - | Additional CSS class names |
| `style` | `CSSProperties` | No | - | Inline styles for the container |

## Ref Methods

| Method | Type | Description |
|--------|------|-------------|
| `reset` | `() => void` | Reset the captcha widget |
| `execute` | `() => Promise<string>` | Execute invisible captcha and get token |
| `getResponse` | `() => string \| null` | Get the current response token |

## Provider-Specific Notes

### Google reCAPTCHA

- Uses reCAPTCHA v2 ("I'm not a robot" checkbox)
- Get your site key from [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)

### hCaptcha

- Privacy-focused alternative to reCAPTCHA
- Get your site key from [hCaptcha Dashboard](https://dashboard.hcaptcha.com/)

### Cloudflare Turnstile

- Non-interactive, privacy-preserving captcha
- Get your site key from [Cloudflare Dashboard](https://dash.cloudflare.com/)

## License

MIT
