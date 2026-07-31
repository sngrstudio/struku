import { Hono } from "hono";
const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

// Per-user coordination actor Durable Object (ADR-0006). Must be exported from
// the Worker entrypoint so Wrangler can bind the `Coordinator` DO class.
export { Coordinator } from "./coordinator";

export default app;
