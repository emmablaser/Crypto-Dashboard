import type { Coin } from "../lib/coinbase";
import { formatBtc, formatCompact, formatCurrency } from "../lib/format";
import { CoinIcon } from "./CoinIcon";
import { ChangeBadge } from "./ChangeBadge";
import { Badge, cardStyles } from "./ui";

export interface CoinCardProps {
  coin: Coin;
  /** Exchange rate of this coin expressed in BTC. */
  btcRate: number;
}

export function CoinCard({ coin, btcRate }: CoinCardProps) {
  return (
    <article className={`${cardStyles()} flex h-full flex-col p-5`}>
      <div className="flex items-center gap-3">
        <CoinIcon symbol={coin.symbol} size={40} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{coin.name}</p>
          <Badge className="mt-0.5">{coin.symbol}</Badge>
        </div>
        <div className="ml-auto">
          <ChangeBadge value={coin.price_change_percentage_24h} />
        </div>
      </div>

      <dl className="mt-5 space-y-2">
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-muted">
            USD
          </dt>
          <dd className="text-xl font-bold text-content">
            {formatCurrency(coin.current_price)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-muted">
            BTC
          </dt>
          <dd className="font-mono text-sm text-content-muted">
            {formatBtc(btcRate)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 border-t border-border pt-3 text-xs text-content-muted">
        Vol {formatCompact(coin.total_volume)}
      </p>
    </article>
  );
}
