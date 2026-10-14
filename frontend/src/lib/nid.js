export function isPlausibleNid(value) {
  const nid = String(value || "");
  return /^(?:[0-9]{10}|[0-9]{13}|[0-9]{17})$/.test(nid)
    && !/^([0-9])\1+$/.test(nid)
    && !"012345678901234567890123456789".includes(nid)
    && !"987654321098765432109876543210".includes(nid);
}

export function isNidProfileComplete(form, today = new Date().toISOString().slice(0, 10)) {
  const name = String(form.name || '').trim();
  const dob = String(form.date_of_birth || '');
  if (!name || name.length > 255 || !isPlausibleNid(form.nid_number)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob <= '1900-01-01' || dob >= today) return false;
  const parsed = new Date(`${dob}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dob;
}
