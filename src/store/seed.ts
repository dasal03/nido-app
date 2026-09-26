import * as Crypto from 'expo-crypto';

import { GOAL_COLORS } from '@/theme';
import type { Goal, Transaction } from './types';

function daysAgo(n: number, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function monthsFromNow(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}

/** Example goals and movements so a new couple can explore the app. */
export function buildDemoData(meId: string, partnerId: string): { goals: Goal[]; transactions: Transaction[] } {
  const goal = (name: string, icon: string, target: number, color: string, deadline: string | null): Goal => ({
    id: Crypto.randomUUID(),
    name,
    icon,
    target,
    color,
    createdAt: daysAgo(70),
    deadline,
  });
  const trip = goal('Viaje a Japón', 'plane', 60000, GOAL_COLORS[0], monthsFromNow(8));
  const emergency = goal('Fondo de emergencia', 'shield', 30000, GOAL_COLORS[2], null);
  const sofa = goal('Nuevo sofá', 'sofa', 12000, GOAL_COLORS[1], monthsFromNow(3));

  const tx = (
    days: number,
    by: string,
    amount: number,
    goalId: string | null,
    note: string,
    type: Transaction['type'] = 'deposit',
  ): Transaction => ({
    id: Crypto.randomUUID(),
    type,
    amount,
    by,
    goalId,
    note,
    date: daysAgo(days, 9 + (days % 10)),
    reactions: {},
    comments: [],
  });

  const me = meId;
  const ana = partnerId;
  const transactions: Transaction[] = [
    tx(0, me, 1500, trip.id, 'Quincena ✨'),
    tx(1, ana, 800, sofa.id, 'Venta de ropa'),
    tx(3, ana, 2000, trip.id, 'Bono del trabajo'),
    tx(6, me, 500, null, 'Redondeo semanal'),
    tx(9, me, 1200, null, 'Cena en casa', 'withdraw'),
    tx(12, ana, 3000, emergency.id, 'Quincena'),
    tx(15, me, 3000, emergency.id, 'Quincena'),
    tx(20, me, 2500, trip.id, 'Freelance'),
    tx(26, ana, 1500, sofa.id, ''),
    tx(30, ana, 4000, trip.id, 'Quincena'),
    tx(34, me, 4000, trip.id, 'Quincena'),
    tx(40, me, 2000, null, 'Apertura del nido 🪺'),
    tx(40, ana, 2000, null, 'Apertura del nido 🪺'),
    tx(45, me, 5000, emergency.id, 'Aguinaldo'),
    tx(50, ana, 2500, emergency.id, ''),
  ];
  // A bit of social activity so the sample nest feels alive.
  transactions[1].reactions = { [me]: '❤️' };
  transactions[2].reactions = { [me]: '🎉' };
  transactions[2].comments = [
    { id: Crypto.randomUUID(), by: me, text: '¡Bien! Ya casi Japón 🇯🇵', date: daysAgo(3, 20) },
    { id: Crypto.randomUUID(), by: ana, text: '¡Vamos! 💪', date: daysAgo(3, 21) },
  ];
  return { goals: [trip, emergency, sofa], transactions };
}
