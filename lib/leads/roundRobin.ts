export type RoundRobinSalesperson = {
  id: string | number;
  name: string;
  active?: boolean | null;
  rotationOrder?: number | null;
};

export type LeadAssignment = {
  leadId: string;
  salespersonId: string;
  salespersonName: string;
  sequence: number;
  assignedAt: string;
};

export type AssignmentStore = {
  nextSequence: () => Promise<number>;
  claim: (assignment: LeadAssignment) => Promise<LeadAssignment>;
};

export function orderActiveSalespeople(
  salespeople: readonly RoundRobinSalesperson[],
) {
  return salespeople
    .filter((salesperson) => salesperson.active !== false)
    .sort((left, right) => {
      const orderDifference =
        (left.rotationOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.rotationOrder ?? Number.MAX_SAFE_INTEGER);

      if (orderDifference !== 0) return orderDifference;
      return String(left.id).localeCompare(String(right.id));
    });
}

export function selectRoundRobinSalesperson(
  salespeople: readonly RoundRobinSalesperson[],
  sequence: number,
) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError("Round-robin sequence must be a positive safe integer");
  }

  const eligible = orderActiveSalespeople(salespeople);
  if (eligible.length === 0) return null;

  return eligible[(sequence - 1) % eligible.length];
}

export async function assignLeadRoundRobin({
  leadId,
  salespeople,
  store,
  now = () => new Date(),
}: {
  leadId: string;
  salespeople: readonly RoundRobinSalesperson[];
  store: AssignmentStore;
  now?: () => Date;
}) {
  const sequence = await store.nextSequence();
  const salesperson = selectRoundRobinSalesperson(salespeople, sequence);
  if (!salesperson) return null;

  return store.claim({
    leadId,
    salespersonId: String(salesperson.id),
    salespersonName: salesperson.name,
    sequence,
    assignedAt: now().toISOString(),
  });
}
