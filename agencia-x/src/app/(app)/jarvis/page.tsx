import { JarvisChat } from "@/components/jarvis/jarvis-chat";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Assistente" };

export default function JarvisPage() {
  return (
    <Card className="mx-auto h-[calc(100vh-8rem)] max-w-3xl overflow-hidden">
      <JarvisChat variant="full" />
    </Card>
  );
}
