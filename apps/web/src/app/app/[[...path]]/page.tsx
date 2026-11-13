import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { WalletGate } from "@/components/wallet-gate";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  if (path[0] === "receipts" && path.length === 2)
    redirect(`/receipts/${encodeURIComponent(path[1])}`);
  return (
    <WalletGate>
      <Workspace />
    </WalletGate>
  );
}
