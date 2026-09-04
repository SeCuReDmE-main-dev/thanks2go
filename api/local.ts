import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const app = await createApp();
app.listen(port, "127.0.0.1", () => console.log(`Thanks2Go API listening on http://127.0.0.1:${port}`));
