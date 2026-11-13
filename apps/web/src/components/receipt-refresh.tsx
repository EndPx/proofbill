import { RefreshCw } from "lucide-react";
export function ReceiptRefresh() {
  return (
    <form method="get">
      <button type="submit" className="button secondary">
        <RefreshCw size={16} aria-hidden="true" />
        Refresh receipt
      </button>
    </form>
  );
}
