export function localInput(iso: string, timezone = "America/Managua") {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}
export function zonedISO(value: string, timezone = "America/Managua") {
  const target = Date.parse(value + "Z");
  if (!Number.isFinite(target)) throw new Error("Fecha inválida.");
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const displayed = Date.parse(
      localInput(new Date(guess).toISOString(), timezone) + "Z",
    );
    guess += target - displayed;
  }
  return new Date(guess).toISOString();
}
export function addDays(key: string, days: number) {
  const date = new Date(key + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
