/* ---------------------------------------------------------------------------
   The cost ledger.

   Three of the four services report what a call actually cost, so the ledger
   records reported figures and marks anything else as an estimate. That
   distinction is the point: a run report that mixes measured and guessed
   spend into one number is a run report you can't act on.

     Exa           costDollars.total          reported
     Perplexity    usage.cost.total_cost      reported
     DataForSEO    top-level `cost`           reported
     Firecrawl     metadata.creditsUsed       credits only — no dollar figure,
                                              so it needs a configured rate and
                                              is always labelled an estimate.

   Cache hits cost nothing and are recorded at $0 with `cached: true`, so the
   ledger also tells you how much of a run was free.
--------------------------------------------------------------------------- */

export type CostBasis = 'reported' | 'estimated' | 'free';

export interface LedgerEntry {
  service: string;
  operation: string;
  usd: number;
  basis: CostBasis;
  cached: boolean;
  /** Firecrawl only: the raw credit count behind the estimate. */
  credits?: number;
  note?: string;
}

export const DEFAULT_BUDGET_USD = 5;

/**
 * Firecrawl's published rate at the Standard tier: 100,000 credits for $333/mo.
 * Configurable because it changes with the plan, and labelled an estimate
 * wherever it appears. Set FIRECRAWL_USD_PER_CREDIT to override.
 */
export const DEFAULT_FIRECRAWL_USD_PER_CREDIT = 0.00333;

export class BudgetExceeded extends Error {
  constructor(
    readonly spent: number,
    readonly ceiling: number,
    readonly attempted: string
  ) {
    super(
      `run budget exceeded: $${spent.toFixed(4)} spent of $${ceiling.toFixed(2)} ceiling, ` +
        `refusing "${attempted}". Raise EXPOSURE_RUN_BUDGET_USD or narrow the run.`
    );
    this.name = 'BudgetExceeded';
  }
}

export class Ledger {
  readonly entries: LedgerEntry[] = [];
  readonly ceiling: number;
  readonly firecrawlRate: number;

  constructor(ceiling?: number, firecrawlRate?: number) {
    const fromEnv = Number(process.env.EXPOSURE_RUN_BUDGET_USD);
    this.ceiling = ceiling ?? (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_BUDGET_USD);
    const rateEnv = Number(process.env.FIRECRAWL_USD_PER_CREDIT);
    this.firecrawlRate =
      firecrawlRate ??
      (Number.isFinite(rateEnv) && rateEnv > 0 ? rateEnv : DEFAULT_FIRECRAWL_USD_PER_CREDIT);
  }

  get spent(): number {
    return this.entries.reduce((sum, e) => sum + e.usd, 0);
  }

  get spentReported(): number {
    return this.entries.filter((e) => e.basis === 'reported').reduce((s, e) => s + e.usd, 0);
  }

  get spentEstimated(): number {
    return this.entries.filter((e) => e.basis === 'estimated').reduce((s, e) => s + e.usd, 0);
  }

  get remaining(): number {
    return this.ceiling - this.spent;
  }

  record(entry: LedgerEntry): void {
    this.entries.push(entry);
  }

  free(service: string, operation: string, note = 'cache hit'): void {
    this.record({ service, operation, usd: 0, basis: 'free', cached: true, note });
  }

  reported(service: string, operation: string, usd: number, note?: string): void {
    this.record({ service, operation, usd, basis: 'reported', cached: false, note });
  }

  /** Firecrawl: credits -> dollars at the configured rate. Always an estimate. */
  fromCredits(operation: string, credits: number, note?: string): void {
    this.record({
      service: 'firecrawl',
      operation,
      usd: credits * this.firecrawlRate,
      basis: 'estimated',
      cached: false,
      credits,
      note: note ?? `${credits} credit(s) at $${this.firecrawlRate}/credit (configured rate)`,
    });
  }

  /**
   * Called before every paid call. Throws once the ceiling is reached — the
   * pipeline aborts rather than exceeding it, as README promises.
   *
   * `expected` is a conservative pre-flight guess used only for the headroom
   * check; the entry that lands afterwards carries the real figure.
   */
  assertHeadroom(operation: string, expected = 0.05): void {
    if (this.spent + expected > this.ceiling) {
      throw new BudgetExceeded(this.spent, this.ceiling, operation);
    }
  }

  byService(): { service: string; usd: number; calls: number; cached: number; basis: CostBasis }[] {
    const groups = new Map<string, { usd: number; calls: number; cached: number; basis: CostBasis }>();
    for (const e of this.entries) {
      const g = groups.get(e.service) ?? { usd: 0, calls: 0, cached: 0, basis: 'free' as CostBasis };
      g.usd += e.usd;
      g.calls += 1;
      if (e.cached) g.cached += 1;
      // A service is "estimated" overall if any of its paid entries were.
      if (e.basis === 'estimated') g.basis = 'estimated';
      else if (e.basis === 'reported' && g.basis !== 'estimated') g.basis = 'reported';
      groups.set(e.service, g);
    }
    return [...groups.entries()].map(([service, g]) => ({ service, ...g }));
  }

  format(): string {
    const lines = [
      `Run cost: $${this.spent.toFixed(4)} of $${this.ceiling.toFixed(2)} ceiling` +
        ` (reported $${this.spentReported.toFixed(4)}, estimated $${this.spentEstimated.toFixed(4)})`,
    ];
    for (const s of this.byService().sort((a, b) => b.usd - a.usd)) {
      const label = s.basis === 'estimated' ? ' (estimate — no dollar figure from the API)' : '';
      lines.push(
        `  ${s.service.padEnd(12)} $${s.usd.toFixed(4)}  ${s.calls} call(s), ${s.cached} from cache${label}`
      );
    }
    return lines.join('\n');
  }
}
