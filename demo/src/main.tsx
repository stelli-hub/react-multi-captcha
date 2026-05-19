import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

// StrictMode is toggled per-section inside <App> so we can A/B specific cases.
createRoot(root).render(<App />);
