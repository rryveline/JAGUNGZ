import { createFileRoute } from "@tanstack/react-router";
import { proxyDetectFrame } from "@/server/inference-proxy.server";

export const Route = createFileRoute("/api/detect/frame")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyDetectFrame(request),
    },
  },
});
