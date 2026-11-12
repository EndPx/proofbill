import { Workspace } from "@/components/workspace";
import { WalletGate } from "@/components/wallet-gate";
export default function Page() {
  return (
    <WalletGate>
      <Workspace />
    </WalletGate>
  );
}
