import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "teacher-assistant-ai",
  eventKey: process.env.INNGEST_EVENT_KEY ?? "local",
  baseUrl: process.env.INNGEST_BASE_URL,
  // Disable signature verification in local dev
  isDev: process.env.NODE_ENV !== "production",
});