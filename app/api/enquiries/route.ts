import { handleResidentialLead } from "../../../lib/crm/residential-ingress";

export async function POST(request: Request) {
  return handleResidentialLead(request, "enquiry");
}
