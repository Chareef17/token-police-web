import { amount, units } from './amount.mjs';
import { tokenxGet } from './tokenx-transport.mjs';
import { tokens } from './token-holders.mjs';

let cached: { until: number; total: bigint } | null = null;

export async function ge6SupplySummary(votedTotal: string) {
  try {
    let total = cached?.until && cached.until > Date.now() ? cached.total : null;
    if (total === null) {
      const token = await tokenxGet(`/tokens/${tokens.ge6}`);
      if (String(token.decimals) !== '18' || !/^\d+$/.test(String(token.total_supply))) throw new Error('Invalid GE6 supply');
      total = BigInt(token.total_supply);
      cached = { total, until: Date.now() + 5 * 60_000 };
    }
    const unvoted = total - units(votedTotal);
    if (unvoted < 0n) throw new Error('GE6 votes exceed supply');
    return { totalSupply: amount(total), unvoted: amount(unvoted) };
  } catch (error) {
    console.error('GE6 supply unavailable', error);
    return { totalSupply: null, unvoted: null };
  }
}
