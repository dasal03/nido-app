export interface User {
  id: string;
  /** Short shareable code used to link two accounts, e.g. "NIDO-7KQ2P". */
  code: string;
  name: string;
  /** Unique handle (lowercase, no "@"), usable to sign in. */
  username: string;
  email: string;
  phone: string;
  birthday: string;
  /** Profile photo as a data URI (resized), or null. */
  photo: string | null;
  /** Nests (couples) this user belongs to. */
  coupleIds: string[];
  /** The nest currently shown in the app. */
  activeCoupleId: string | null;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target: number;
  color: string;
  createdAt: string;
  deadline: string | null;
}

export type TransactionType = 'deposit' | 'withdraw';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  /** User id of the member who made the movement. */
  by: string;
  /** null means the shared common fund (not tied to a goal). */
  goalId: string | null;
  note: string;
  date: string;
  /** Emoji reaction per member id. */
  reactions: Record<string, string>;
  comments: Comment[];
  /** Set when the movement came from a recurring contribution. */
  recurringId?: string;
}

export interface Comment {
  id: string;
  by: string;
  text: string;
  date: string;
}

export type Frequency = 'weekly' | 'biweekly' | 'monthly';

/** A scheduled contribution; when due, its owner confirms or skips it with one tap. */
export interface RecurringRule {
  id: string;
  by: string;
  amount: number;
  goalId: string | null;
  frequency: Frequency;
  /** Next due date (ISO). */
  nextDate: string;
  active: boolean;
  createdAt: string;
}

export interface Couple {
  id: string;
  /** Custom nest name; null shows "Me & Partner". */
  name: string | null;
  memberIds: [string, string];
  currency: string;
  createdAt: string;
  /** Set when the couple unlinks; archived nests are hidden. */
  archivedAt: string | null;
  goals: Goal[];
  transactions: Transaction[];
  recurring: RecurringRule[];
  /** Agreed contribution share per member id, in percent (sums to 100). null means 50/50. */
  split: Record<string, number> | null;
  /** Name of the couple's pet; null uses the default. */
  petName: string | null;
}
