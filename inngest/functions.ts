import { inngest } from "./client";
import { submissionJanitor } from "./janitor";
import { processSubmissionPipeline } from "./process-submission";
import { resubmissionPoller } from "./resubmission-poller";

export const helloWorld = inngest.createFunction(
  { id: "hello-world", triggers: [{ event: "test/hello.world" }] },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    return { event, body: "Hello, World!" };
  }
);

export const functions = [
  helloWorld,
  submissionJanitor,
  processSubmissionPipeline,
  resubmissionPoller, // polls every 2 min for student resubmissions
];