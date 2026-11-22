import { createFileRoute } from "@tanstack/react-router";
import { proxyStatus } from "@/server/inference-proxy.server";

export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () => proxyStatus(),
    },
  },
});
