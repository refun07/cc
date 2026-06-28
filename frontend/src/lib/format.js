export const taka = (n) =>
  "৳" + Number(n || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 });

export const SESSION_LABELS = {
  full_day: "Full Day",
  half_day_morning: "Half Day (Morning)",
  half_day_evening: "Half Day (Evening)",
};

export const sessionLabel = (s) => SESSION_LABELS[s] || s;
