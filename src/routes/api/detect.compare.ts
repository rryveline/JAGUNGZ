import { createFileRoute } from "@tanstack/react-router";
import { proxyCompare } from "@/server/inference-proxy.server";

export const Route = createFileRoute("/api/detect/compare")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyCompare(request),
    },
  },
});
