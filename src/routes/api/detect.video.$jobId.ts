import { createFileRoute } from "@tanstack/react-router";
import { proxyVideoJobStatus } from "@/server/inference-proxy.server";

export const Route = createFileRoute("/api/detect/video/$jobId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => proxyVideoJobStatus(params.jobId, request),
    },
  },
});
