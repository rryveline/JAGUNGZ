import { createFileRoute } from "@tanstack/react-router";
import { DetectionStudio } from "@/components/detection-studio";

export const Route = createFileRoute("/detect")({ component: DetectPage });

function DetectPage() {
  return <DetectionStudio />;
}
