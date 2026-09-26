import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { TranslationKey } from '@/i18n/es';
import type { Couple, User } from '@/store/types';
import { formatMoney, formatShortDate } from './format';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface ExportInput {
  couple: Couple;
  nestName: string;
  members: User[];
  t: Translate;
  locale: string;
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nido';
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const escapeHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function rows({ couple, members, t, locale }: ExportInput) {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? '';
  const dest = (goalId: string | null) => couple.goals.find((g) => g.id === goalId)?.name ?? t('common.commonFund');
  return couple.transactions.map((tx) => ({
    date: new Date(tx.date).toLocaleString(locale),
    type: t(tx.type === 'deposit' ? 'export.deposit' : 'export.withdraw'),
    member: name(tx.by),
    destination: dest(tx.goalId),
    amount: tx.type === 'deposit' ? tx.amount : -tx.amount,
    note: tx.note,
  }));
}

async function deliver(content: string, fileName: string, mimeType: string, uti: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: fileName });
}

/** Spreadsheet of every movement in the nest, shared via the system share sheet (or downloaded on web). */
export async function exportCsv(input: ExportInput) {
  const { t } = input;
  const header = [t('export.colDate'), t('export.colType'), t('export.colMember'), t('export.colDestination'), t('export.colAmount'), t('export.colNote')];
  const lines = [header, ...rows(input).map((r) => [r.date, r.type, r.member, r.destination, r.amount, r.note])].map((cols) => cols.map(csvCell).join(','));
  // BOM so Excel detects UTF-8 (accents, emoji).
  await deliver('﻿' + lines.join('\n'), `${slug(input.nestName)}.csv`, 'text/csv', 'public.comma-separated-values-text');
}

/** Printable report: balance, goals and movements. */
export async function exportPdf(input: ExportInput) {
  const { couple, nestName, t, locale } = input;
  const money = (n: number) => formatMoney(n, couple.currency);
  const balance = couple.transactions.reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
  const saved = (goalId: string) => couple.transactions.filter((tx) => tx.goalId === goalId).reduce((s, tx) => s + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 32px; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #0A1433; }
    h1 { font-size: 26px; margin: 0; } .muted { color: #5B6475; font-size: 12px; }
    .hero { background: linear-gradient(135deg, #001C64, #0070E0); color: #fff; border-radius: 16px; padding: 20px; margin: 20px 0; }
    .hero .label { opacity: .8; font-size: 13px; } .hero .value { font-size: 32px; font-weight: 800; }
    h2 { font-size: 16px; margin: 24px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; color: #5B6475; font-weight: 600; border-bottom: 1px solid #E4E8EF; padding: 6px 4px; }
    td { border-bottom: 1px solid #F0F2F6; padding: 6px 4px; } .num { text-align: right; white-space: nowrap; }
    .pos { color: #0B8A4B; }
  </style></head><body>
    <h1>🪺 ${escapeHtml(t('export.reportTitle'))} · ${escapeHtml(nestName)}</h1>
    <div class="muted">${escapeHtml(t('export.generated', { date: formatShortDate(new Date().toISOString(), locale) }))}</div>
    <div class="hero"><div class="label">${escapeHtml(t('export.balance'))}</div><div class="value">${money(balance)}</div></div>
    <h2>${escapeHtml(t('export.goals'))}</h2>
    <table><tr><th>${escapeHtml(t('newGoal.name'))}</th><th class="num">${escapeHtml(t('export.colAmount'))}</th><th class="num">%</th></tr>
      ${couple.goals
        .map((g) => `<tr><td>${escapeHtml(g.name)}</td><td class="num">${money(saved(g.id))} / ${money(g.target)}</td><td class="num">${Math.round((saved(g.id) / g.target) * 100)}%</td></tr>`)
        .join('')}
    </table>
    <h2>${escapeHtml(t('export.movements'))}</h2>
    <table><tr><th>${escapeHtml(t('export.colDate'))}</th><th>${escapeHtml(t('export.colMember'))}</th><th>${escapeHtml(t('export.colDestination'))}</th><th>${escapeHtml(t('export.colNote'))}</th><th class="num">${escapeHtml(t('export.colAmount'))}</th></tr>
      ${rows(input)
        .map((r) => `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.member)}</td><td>${escapeHtml(r.destination)}</td><td>${escapeHtml(r.note)}</td><td class="num ${r.amount > 0 ? 'pos' : ''}">${r.amount > 0 ? '+' : '−'}${money(Math.abs(r.amount))}</td></tr>`)
        .join('')}
    </table>
  </body></html>`;

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle: `${slug(nestName)}.pdf` });
}
