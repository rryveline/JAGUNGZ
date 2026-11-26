import { createFileRoute } from "@tanstack/react-router";
import { proxyDetectVideoStart } from "@/server/inference-proxy.server";

export const Route = createFileRoute("/api/detect/video")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyDetectVideoStart(request),
    },
  },
});
