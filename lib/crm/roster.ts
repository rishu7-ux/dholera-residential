export type NoidaStaffRole = "salesperson" | "team-leader";

export type NoidaStaffRosterRow = {
  fullName: string;
  officialEmail: string;
  role: NoidaStaffRole;
  office: "noida";
  assignmentOrder: number | null;
  active: boolean;
  existingUserReference: string | null;
};

export type RosterValidation = {
  valid: boolean;
  errors: string[];
};

/** Validates the owner-supplied roster without creating or updating users. */
export function validateNoidaStaffRoster(rows: NoidaStaffRosterRow[]): RosterValidation {
  const errors: string[] = [];
  const salespeople = rows.filter((row) => row.role === "salesperson");
  const leaders = rows.filter((row) => row.role === "team-leader");

  if (salespeople.length !== 10) errors.push("Roster must contain exactly 10 salespeople.");
  if (leaders.length !== 1) errors.push("Roster must contain exactly 1 Team Leader.");

  const emails = new Set<string>();
  const existingReferences = new Set<string>();
  const orders = new Set<number>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = row.officialEmail.trim().toLowerCase();
    if (!row.fullName.trim()) errors.push(`Row ${rowNumber}: full name is required.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Row ${rowNumber}: a valid official business email is required.`);
    if (emails.has(email)) errors.push(`Row ${rowNumber}: official business email is duplicated.`);
    emails.add(email);
    if (row.office !== "noida") errors.push(`Row ${rowNumber}: office must be noida.`);
    if (row.role === "salesperson") {
      if (!Number.isInteger(row.assignmentOrder) || row.assignmentOrder! < 1 || row.assignmentOrder! > 10) {
        errors.push(`Row ${rowNumber}: salesperson assignment order must be an integer from 1 to 10.`);
      } else if (orders.has(row.assignmentOrder!)) {
        errors.push(`Row ${rowNumber}: salesperson assignment order is duplicated.`);
      } else {
        orders.add(row.assignmentOrder!);
      }
    } else if (row.assignmentOrder !== null) {
      errors.push(`Row ${rowNumber}: Team Leader assignment order must be blank.`);
    }
    const existingRef = row.existingUserReference?.trim();
    if (existingRef && existingReferences.has(existingRef)) errors.push(`Row ${rowNumber}: existing user reference is duplicated.`);
    if (existingRef) existingReferences.add(existingRef);
  });

  if (salespeople.length === 10) {
    for (let order = 1; order <= 10; order += 1) {
      if (!orders.has(order)) errors.push(`Salesperson assignment order ${order} is missing.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
