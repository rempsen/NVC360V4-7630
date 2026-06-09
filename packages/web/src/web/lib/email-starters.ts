import type { EmailBlock } from "../components/email-editor";

const uid = () => Math.random().toString(36).slice(2, 9);

/** A sensible starting design when a recipient has no email design yet. */
export function starterDesignForRecipient(recipient: string, eventLabel: string): EmailBlock[] {
  if (recipient === "tech") {
    return [
      { id: uid(), type: "heading", text: "New job update", size: "lg" },
      { id: uid(), type: "text", text: "Hi {{techName}}, there's an update on a job assigned to you." },
      { id: uid(), type: "details", rows: [
        { label: "Job", value: "{{jobName}} (#{{jobNumber}})" },
        { label: "Customer", value: "{{firstName}}" },
        { label: "When", value: "{{when}}" },
        { label: "Address", value: "{{address}}" },
      ] },
      { id: uid(), type: "button", label: "Open in app", url: "{{trackUrl}}" },
    ];
  }
  if (recipient === "office") {
    return [
      { id: uid(), type: "heading", text: `${eventLabel}`, size: "md" },
      { id: uid(), type: "text", text: "A work order has an update." },
      { id: uid(), type: "details", rows: [
        { label: "Job", value: "{{jobName}} (#{{jobNumber}})" },
        { label: "Customer", value: "{{firstName}}" },
        { label: "Technician", value: "{{techName}}" },
        { label: "When", value: "{{when}}" },
      ] },
    ];
  }
  // client
  return [
    { id: uid(), type: "heading", text: "Hi {{firstName}}, an update on your service", size: "lg" },
    { id: uid(), type: "text", text: "Here's the latest on your **{{service}}** appointment (#{{jobNumber}})." },
    { id: uid(), type: "details", rows: [
      { label: "Service", value: "{{service}}" },
      { label: "When", value: "{{when}}" },
      { label: "Address", value: "{{address}}" },
      { label: "Technician", value: "{{techName}}" },
    ] },
    { id: uid(), type: "button", label: "Track live", url: "{{trackUrl}}" },
    { id: uid(), type: "spacer", size: "sm" },
    { id: uid(), type: "text", text: "Questions? Just reply to this email." },
  ];
}
