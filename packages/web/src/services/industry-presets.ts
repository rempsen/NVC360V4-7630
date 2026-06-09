// Industry (ICP) presets — the single source of truth for the 15 supported industries.
// Drives: New Company dropdown, service-library seeding, work-order template generation,
// and the Form Builder default category dropdown.

export type IndustryPreset = {
  id: string; // slug stored on companies.industry
  label: string; // human label in dropdowns
  workerNoun: string; // technician | installer | rider | etc.
  // Service library seeded on company create (schema.services rows).
  services: { name: string; category: string; durationMins: number }[];
  // Suggested work-order template names (drives template-scout primary intent).
  templates: string[];
  // Default Form Builder categories (first = default).
  categories: string[];
};

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    id: "hvac",
    label: "HVAC Contractors",
    workerNoun: "technician",
    services: [
      { name: "Furnace Repair", category: "HVAC", durationMins: 90 },
      { name: "AC Repair", category: "HVAC", durationMins: 90 },
      { name: "Seasonal Maintenance", category: "HVAC", durationMins: 60 },
      { name: "System Installation", category: "HVAC", durationMins: 240 },
      { name: "Thermostat Install", category: "HVAC", durationMins: 60 },
      { name: "Duct Cleaning", category: "HVAC", durationMins: 120 },
    ],
    templates: [
      "Emergency Dispatch",
      "Maintenance Visit",
      "Installation Work Order",
      "Warranty Service Call",
      "After-Hours Escalation",
    ],
    categories: ["HVAC", "Maintenance", "Installation", "Emergency"],
  },
  {
    id: "plumbing",
    label: "Plumbing Companies",
    workerNoun: "plumber",
    services: [
      { name: "Leak Repair", category: "Plumbing", durationMins: 90 },
      { name: "Drain Cleaning", category: "Plumbing", durationMins: 60 },
      { name: "Water Heater Install", category: "Plumbing", durationMins: 180 },
      { name: "Fixture Replacement", category: "Plumbing", durationMins: 90 },
      { name: "Sewer Line Service", category: "Plumbing", durationMins: 180 },
      { name: "Emergency Burst Pipe", category: "Plumbing", durationMins: 120 },
    ],
    templates: [
      "Emergency Call-Out",
      "Service & Repair",
      "New Installation",
      "Inspection & Estimate",
      "After-Hours Escalation",
    ],
    categories: ["Plumbing", "Repair", "Installation", "Emergency"],
  },
  {
    id: "electrical",
    label: "Electrical Contractors",
    workerNoun: "electrician",
    services: [
      { name: "Panel Upgrade", category: "Electrical", durationMins: 240 },
      { name: "Outlet & Switch Repair", category: "Electrical", durationMins: 60 },
      { name: "Lighting Installation", category: "Electrical", durationMins: 120 },
      { name: "EV Charger Install", category: "Electrical", durationMins: 180 },
      { name: "Electrical Inspection", category: "Electrical", durationMins: 90 },
      { name: "Emergency Power Restore", category: "Electrical", durationMins: 120 },
    ],
    templates: [
      "Emergency Dispatch",
      "Service & Repair",
      "Installation Work Order",
      "Safety Inspection",
      "After-Hours Escalation",
    ],
    categories: ["Electrical", "Repair", "Installation", "Inspection"],
  },
  {
    id: "restoration",
    label: "Restoration & Emergency Services",
    workerNoun: "technician",
    services: [
      { name: "Water Damage Mitigation", category: "Restoration", durationMins: 240 },
      { name: "Fire & Smoke Cleanup", category: "Restoration", durationMins: 240 },
      { name: "Mold Remediation", category: "Restoration", durationMins: 180 },
      { name: "Structural Drying", category: "Restoration", durationMins: 120 },
      { name: "Emergency Board-Up", category: "Restoration", durationMins: 90 },
      { name: "Contents Cleaning", category: "Restoration", durationMins: 180 },
    ],
    templates: [
      "Emergency Response",
      "Mitigation Work Order",
      "Remediation Job",
      "Insurance Documentation",
      "After-Hours Escalation",
    ],
    categories: ["Restoration", "Mitigation", "Remediation", "Emergency"],
  },
  {
    id: "appliance",
    label: "Appliance Repair & Home Service",
    workerNoun: "technician",
    services: [
      { name: "Refrigerator Repair", category: "Appliance", durationMins: 90 },
      { name: "Washer / Dryer Repair", category: "Appliance", durationMins: 90 },
      { name: "Oven & Range Repair", category: "Appliance", durationMins: 90 },
      { name: "Dishwasher Repair", category: "Appliance", durationMins: 75 },
      { name: "Appliance Installation", category: "Appliance", durationMins: 90 },
      { name: "Diagnostic Visit", category: "Appliance", durationMins: 45 },
    ],
    templates: [
      "Service Call",
      "Diagnostic & Estimate",
      "Installation Work Order",
      "Warranty Service Call",
      "Follow-Up Visit",
    ],
    categories: ["Appliance", "Repair", "Installation", "Diagnostic"],
  },
  {
    id: "courier",
    label: "Courier & Delivery Companies",
    workerNoun: "driver",
    services: [
      { name: "Same-Day Delivery", category: "Delivery", durationMins: 60 },
      { name: "Scheduled Pickup", category: "Delivery", durationMins: 30 },
      { name: "Freight Run", category: "Delivery", durationMins: 120 },
      { name: "Returns Pickup", category: "Delivery", durationMins: 30 },
      { name: "White-Glove Delivery", category: "Delivery", durationMins: 90 },
      { name: "Route Run", category: "Delivery", durationMins: 240 },
    ],
    templates: [
      "Delivery Run",
      "Pickup Order",
      "Failed Delivery Report",
      "Proof of Delivery",
      "Route Manifest",
    ],
    categories: ["Delivery", "Pickup", "Route", "Returns"],
  },
  {
    id: "security",
    label: "Security & Alarm Companies",
    workerNoun: "technician",
    services: [
      { name: "Alarm Installation", category: "Security", durationMins: 180 },
      { name: "Camera / CCTV Install", category: "Security", durationMins: 180 },
      { name: "Access Control Setup", category: "Security", durationMins: 150 },
      { name: "System Service Call", category: "Security", durationMins: 90 },
      { name: "Monitoring Activation", category: "Security", durationMins: 45 },
      { name: "Emergency Response Check", category: "Security", durationMins: 60 },
    ],
    templates: [
      "Installation Work Order",
      "Service Call",
      "Alarm Response",
      "System Inspection",
      "After-Hours Escalation",
    ],
    categories: ["Security", "Installation", "Service", "Inspection"],
  },
  {
    id: "telecom",
    label: "Telecommunications Installers",
    workerNoun: "installer",
    services: [
      { name: "Fiber Installation", category: "Telecom", durationMins: 180 },
      { name: "Internet Setup", category: "Telecom", durationMins: 90 },
      { name: "Cable / Line Repair", category: "Telecom", durationMins: 90 },
      { name: "Equipment Swap", category: "Telecom", durationMins: 60 },
      { name: "Network Troubleshooting", category: "Telecom", durationMins: 90 },
      { name: "Wiring & Termination", category: "Telecom", durationMins: 120 },
    ],
    templates: [
      "Installation Work Order",
      "Service & Repair",
      "Equipment Swap",
      "Trouble Ticket",
      "Site Survey",
    ],
    categories: ["Telecom", "Installation", "Repair", "Survey"],
  },
  {
    id: "roofing",
    label: "Roofing Contractors",
    workerNoun: "roofer",
    services: [
      { name: "Roof Inspection", category: "Roofing", durationMins: 90 },
      { name: "Leak Repair", category: "Roofing", durationMins: 120 },
      { name: "Shingle Replacement", category: "Roofing", durationMins: 240 },
      { name: "Full Roof Replacement", category: "Roofing", durationMins: 480 },
      { name: "Gutter Service", category: "Roofing", durationMins: 120 },
      { name: "Storm Damage Assessment", category: "Roofing", durationMins: 90 },
    ],
    templates: [
      "Inspection & Estimate",
      "Repair Work Order",
      "Replacement Job",
      "Storm Damage Claim",
      "Final Walkthrough",
    ],
    categories: ["Roofing", "Inspection", "Repair", "Replacement"],
  },
  {
    id: "landscaping",
    label: "Property Maintenance & Landscaping",
    workerNoun: "crew",
    services: [
      { name: "Lawn Maintenance", category: "Landscaping", durationMins: 90 },
      { name: "Seasonal Cleanup", category: "Landscaping", durationMins: 180 },
      { name: "Snow Removal", category: "Maintenance", durationMins: 90 },
      { name: "Tree & Shrub Care", category: "Landscaping", durationMins: 120 },
      { name: "Irrigation Service", category: "Landscaping", durationMins: 90 },
      { name: "Property Inspection", category: "Maintenance", durationMins: 60 },
    ],
    templates: [
      "Maintenance Visit",
      "Seasonal Service",
      "Project Work Order",
      "Property Inspection",
      "Recurring Route",
    ],
    categories: ["Landscaping", "Maintenance", "Seasonal", "Inspection"],
  },
  {
    id: "construction",
    label: "Commercial Construction",
    workerNoun: "crew",
    services: [
      { name: "Site Survey", category: "Construction", durationMins: 120 },
      { name: "Demolition", category: "Construction", durationMins: 480 },
      { name: "Framing & Build", category: "Construction", durationMins: 480 },
      { name: "Finishing Work", category: "Construction", durationMins: 240 },
      { name: "Punch List Walkthrough", category: "Construction", durationMins: 120 },
      { name: "Safety Inspection", category: "Construction", durationMins: 90 },
    ],
    templates: [
      "Project Work Order",
      "Daily Site Report",
      "Punch List",
      "Change Order",
      "Safety Inspection",
    ],
    categories: ["Construction", "Site Report", "Inspection", "Punch List"],
  },
  {
    id: "waste",
    label: "Waste & Recycling",
    workerNoun: "driver",
    services: [
      { name: "Residential Pickup", category: "Waste", durationMins: 30 },
      { name: "Commercial Bin Service", category: "Waste", durationMins: 45 },
      { name: "Roll-Off Delivery", category: "Waste", durationMins: 60 },
      { name: "Recycling Collection", category: "Waste", durationMins: 45 },
      { name: "Bulk / Junk Removal", category: "Waste", durationMins: 90 },
      { name: "Hazardous Waste Run", category: "Waste", durationMins: 120 },
    ],
    templates: [
      "Collection Route",
      "Bin Delivery / Swap",
      "Bulk Pickup Order",
      "Missed Pickup Report",
      "Service Manifest",
    ],
    categories: ["Waste", "Route", "Pickup", "Delivery"],
  },
  {
    id: "utility",
    label: "Utility Services",
    workerNoun: "technician",
    services: [
      { name: "Meter Installation", category: "Utility", durationMins: 90 },
      { name: "Service Connection", category: "Utility", durationMins: 120 },
      { name: "Line Inspection", category: "Utility", durationMins: 90 },
      { name: "Outage Response", category: "Utility", durationMins: 120 },
      { name: "Equipment Maintenance", category: "Utility", durationMins: 120 },
      { name: "Disconnect / Reconnect", category: "Utility", durationMins: 60 },
    ],
    templates: [
      "Service Order",
      "Outage Response",
      "Inspection Report",
      "Installation Work Order",
      "After-Hours Escalation",
    ],
    categories: ["Utility", "Service", "Inspection", "Outage"],
  },
  {
    id: "healthcare",
    label: "Healthcare Home Services",
    workerNoun: "caregiver",
    services: [
      { name: "In-Home Care Visit", category: "Healthcare", durationMins: 120 },
      { name: "Medical Equipment Setup", category: "Healthcare", durationMins: 90 },
      { name: "Wellness Check", category: "Healthcare", durationMins: 60 },
      { name: "Therapy Session", category: "Healthcare", durationMins: 90 },
      { name: "Medication Management", category: "Healthcare", durationMins: 45 },
      { name: "Assessment Visit", category: "Healthcare", durationMins: 90 },
    ],
    templates: [
      "Care Visit",
      "Assessment & Care Plan",
      "Equipment Setup",
      "Wellness Check",
      "Follow-Up Visit",
    ],
    categories: ["Healthcare", "Care Visit", "Assessment", "Equipment"],
  },
  {
    id: "municipal",
    label: "Municipal & Public Works",
    workerNoun: "crew",
    services: [
      { name: "Road Maintenance", category: "Public Works", durationMins: 240 },
      { name: "Streetlight Repair", category: "Public Works", durationMins: 90 },
      { name: "Water / Sewer Service", category: "Public Works", durationMins: 180 },
      { name: "Sign & Signal Repair", category: "Public Works", durationMins: 120 },
      { name: "Park & Grounds Upkeep", category: "Public Works", durationMins: 180 },
      { name: "Citizen Request Response", category: "Public Works", durationMins: 90 },
    ],
    templates: [
      "Work Order",
      "Citizen Request",
      "Inspection Report",
      "Maintenance Job",
      "Emergency Response",
    ],
    categories: ["Public Works", "Maintenance", "Inspection", "Request"],
  },
];

export const INDUSTRY_LABELS: { id: string; label: string }[] = INDUSTRY_PRESETS.map(
  (p) => ({ id: p.id, label: p.label }),
);

export function getIndustryPreset(id: string | undefined | null): IndustryPreset | undefined {
  if (!id) return undefined;
  return INDUSTRY_PRESETS.find((p) => p.id === id);
}

export function industryLabel(id: string | undefined | null): string {
  return getIndustryPreset(id)?.label ?? "";
}
