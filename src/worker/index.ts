import { Hono } from "hono";
import { webhook } from "./webhook";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

// Telegram channel round-trip (ticket 10, ADR-0004): webhook -> activation
// gate -> TelegramProvider normalization -> identity resolution -> Coordinator.
app.route("/api", webhook);

// Per-user coordination actor Durable Object (ADR-0006). Must be exported from
// the Worker entrypoint so Wrangler can bind the `Coordinator` DO class.
export { Coordinator } from "./coordinator";

export default app;
