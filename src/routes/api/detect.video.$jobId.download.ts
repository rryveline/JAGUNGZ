import { createFileRoute } from "@tanstack/react-router";
import { proxyVideoDownload } from "@/server/inference-proxy.server";

export const Route = createFileRoute("/api/detect/video/$jobId/download")({
  server: {
    handlers: {
      GET: async ({ params, request }) => proxyVideoDownload(params.jobId, request),
    },
  },
});
