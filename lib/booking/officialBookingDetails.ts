import { parseMoneyInput } from "./parseMoneyInput";

export type OfficialBookingDetails = {
  book_date: string;
  deposit_amount: number;
  total_binder_amount: number;
  merchant_id: string;
  primary_agent_id: string;
  secondary_agent_id?: string;
};

export function parseOfficialBookingDetails(input: {
  bookDate: string;
  deposit: string;
  binder: string;
  merchantId: string;
  primaryAgentId: string;
  secondaryAgentId: string;
}): { details?: OfficialBookingDetails; errors: string[] } {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.bookDate)) {
    errors.push("Enter a valid Book Date.");
  }
  const depositAmount = parseMoneyInput(input.deposit);
  const binderAmount = parseMoneyInput(input.binder);
  if (depositAmount === undefined) {
    errors.push("Deposit must be a nonnegative amount with no more than two decimals.");
  }
  if (binderAmount === undefined) {
    errors.push("Binder must be a nonnegative amount with no more than two decimals.");
  }
  if (!input.merchantId) {
    errors.push("Select an active Merchant.");
  }
  if (!input.primaryAgentId) {
    errors.push("Select a primary Agent.");
  }
  if (input.secondaryAgentId && input.secondaryAgentId === input.primaryAgentId) {
    errors.push("Secondary Agent must be different from the primary Agent.");
  }
  if (errors.length || depositAmount === undefined || binderAmount === undefined) {
    return { errors };
  }
  return {
    errors: [],
    details: {
      book_date: input.bookDate,
      deposit_amount: depositAmount,
      total_binder_amount: binderAmount,
      merchant_id: input.merchantId,
      primary_agent_id: input.primaryAgentId,
      ...(input.secondaryAgentId ? { secondary_agent_id: input.secondaryAgentId } : {}),
    },
  };
}
