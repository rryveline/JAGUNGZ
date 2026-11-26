import { createFileRoute } from "@tanstack/react-router";
import { proxyModelsStatus } from "@/server/inference-proxy.server";

export const Route = createFileRoute("/api/models/status")({
  server: {
    handlers: {
      GET: async () => proxyModelsStatus(),
    },
  },
});
