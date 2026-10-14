export const CENTRE_TYPES = [
  { value: "community_centre", label: "Community Centre" },
  { value: "convention_centre", label: "Convention Centre" },
  { value: "banquet_hall", label: "Banquet Hall" },
  { value: "other", label: "Other" },
];

export const centreTypeLabel = (value) =>
  CENTRE_TYPES.find((type) => type.value === value)?.label || "Other";
