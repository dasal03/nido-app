import type { Couple } from '@/store/types';

/** Current balance of a nest (all goals plus the shared fund). */
export function nestBalance(couple: Couple, goalId?: string | null) {
  return couple.transactions
    .filter((tx) => goalId === undefined || tx.goalId === goalId)
    .reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
}

/**
 * How much each member gets back if the nest is dissolved: the balance split in proportion to
 * what each current member contributed (equal parts if nobody contributed). Amounts in cents-exact
 * decimals; any rounding remainder goes to the largest share so the total matches the balance.
 */
export function computeRefunds(couple: Couple): Record<string, number> {
  const balance = Math.max(nestBalance(couple), 0);
  const deposits: Record<string, number> = Object.fromEntries(couple.memberIds.map((id) => [id, 0]));
  for (const tx of couple.transactions) if (tx.type === 'deposit' && tx.by in deposits) deposits[tx.by] += tx.amount;
  const total = Object.values(deposits).reduce((a, b) => a + b, 0);
  const refunds: Record<string, number> = {};
  for (const id of couple.memberIds) {
    const share = total > 0 ? deposits[id] / total : 1 / couple.memberIds.length;
    refunds[id] = Math.floor(balance * share * 100) / 100;
  }
  const remainder = Math.round((balance - Object.values(refunds).reduce((a, b) => a + b, 0)) * 100) / 100;
  if (remainder > 0) {
    const top = Object.keys(refunds).sort((a, b) => refunds[b] - refunds[a])[0];
    if (top) refunds[top] = Math.round((refunds[top] + remainder) * 100) / 100;
  }
  return refunds;
}
