export function units(value) {
  const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(String(value));
  if (!match) throw new Error('Invalid token amount');
  return BigInt(match[1]) * 10n ** 18n + BigInt((match[2] || '').padEnd(18, '0'));
}
export function amount(raw) {
  const n = BigInt(raw);
  if (n < 0n) throw new Error('Invalid token amount');
  const fraction = (n % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return (n / 10n ** 18n).toString() + (fraction ? '.' + fraction : '');
}
export function sum(values) { return amount(values.reduce((a, v) => a + units(v), 0n)); }
export function display(value) {
  const [whole, fraction] = String(value).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : '');
}
export function addressOf(value) {
  const address = String(value).trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('กรุณากรอก address ให้ครบ 42 ตัวอักษร');
  return address;
}
export function nameOf(value) {
  if (typeof value !== 'string') throw new Error('กรุณากรอกชื่อ');
  const name = value.normalize('NFC').trim();
  if (!name || [...name].length > 60 || /[\p{Cc}\p{Cf}<>]/u.test(name)) throw new Error('ชื่อควรยาว 1–60 ตัวอักษร และไม่มีอักขระพิเศษ < >');
  return name;
}
