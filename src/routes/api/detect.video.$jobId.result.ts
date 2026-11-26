import { createFileRoute } from "@tanstack/react-router";
import { proxyVideoJobResult } from "@/server/inference-proxy.server";

export const Route = createFileRoute("/api/detect/video/$jobId/result")({
  server: {
    handlers: {
      GET: async ({ params }) => proxyVideoJobResult(params.jobId),
    },
  },
});
