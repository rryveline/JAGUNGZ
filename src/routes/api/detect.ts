import { createFileRoute } from "@tanstack/react-router";
import { proxyDetect } from "@/server/inference-proxy.server";

export const Route = createFileRoute("/api/detect")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyDetect(request),
    },
  },
});
