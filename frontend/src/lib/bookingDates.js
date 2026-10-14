export const calendarDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function addCalendarDays(value, days = 1) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return calendarDate(date);
}
