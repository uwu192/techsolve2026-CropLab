import { createTogetherAI } from "@ai-sdk/togetherai";

export const together = createTogetherAI({
  apiKey: process.env.TOGETHER_API_KEY,
});
