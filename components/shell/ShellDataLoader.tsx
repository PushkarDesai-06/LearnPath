import { getShellData } from "@/lib/data/shell";
import { ShellDataPublisher } from "@/components/shell/ShellDataPublisher";

export async function ShellDataLoader({ userId }: { userId: string }) {
  return <ShellDataPublisher data={await getShellData(userId)} />;
}
