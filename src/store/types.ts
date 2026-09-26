export interface User {
  id: string;
  /** Short shareable code used to link two accounts, e.g. "NIDO-7KQ2P". */
  code: string;
  name: string;
  /** Unique handle (lowercase, no "@"), usable to sign in. */
  username: string;
  email: string;
  /** International format: "+57 3012668858". */
  phone: string;
  /** ISO date (YYYY-MM-DD). Private: only visible to its owner. */
  birthday: string;
  /** ISO 3166-1 alpha-2 country of residence, e.g. "CO". */
  country: string;
  /** Private: only visible to its owner. */
  gender: string;
  /** Identity document (private), e.g. type "CC" and its number. */
  documentType: string;
  documentNumber: string;
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
  /** A member's share returned when the nest was dissolved or they left it. */
  refund?: boolean;
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

export type NestKind = 'couple' | 'family';

export type RequestKind = 'withdraw' | 'dissolve' | 'leave';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * An action that needs every other member's approval before it happens: withdrawing money,
 * dissolving the nest, or (families) a member leaving with their share.
 */
export interface ApprovalRequest {
  id: string;
  kind: RequestKind;
  by: string;
  amount: number | null;
  goalId: string | null;
  note: string;
  /** Members who approved (the requester counts as approved). */
  approvals: string[];
  rejectedBy: string | null;
  status: RequestStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Couple {
  id: string;
  /** A couple (2 people) or a family group (2+ people, always named). */
  kind: NestKind;
  /** Custom name; required for families, optional for couples ("Diego y Angélica"). */
  name: string | null;
  /** Current members, in the order they joined. */
  memberIds: string[];
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
  requests: ApprovalRequest[];
}
