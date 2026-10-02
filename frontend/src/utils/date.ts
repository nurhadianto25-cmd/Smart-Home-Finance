// Auto-format date input DDMMYYYY → DD-MM-YYYY
// Given raw string, return { display, iso } where display is dd-mm-yyyy and iso is yyyy-mm-dd (if valid).
export function formatDateInput(raw: string): { display: string; iso: string | null } {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 8);
  let out = "";
  if (digits.length <= 2) out = digits;
  else if (digits.length <= 4) out = `${digits.slice(0, 2)}-${digits.slice(2)}`;
  else out = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  let iso: string | null = null;
  if (digits.length === 8) {
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    const di = parseInt(d, 10);
    const mi = parseInt(m, 10);
    const yi = parseInt(y, 10);
    if (di >= 1 && di <= 31 && mi >= 1 && mi <= 12 && yi >= 1900 && yi <= 2100) {
      iso = `${y}-${m}-${d}`;
    }
  }
  return { display: out, iso };
}

// Convert ISO date (yyyy-mm-dd or full ISO) into display dd-mm-yyyy
export function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}-${y}`;
}
