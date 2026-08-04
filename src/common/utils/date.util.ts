const DURATION_PATTERN = /^(\d+)([smhd])$/;

export function addDuration(date: Date, duration: string): Date {
  const match = DURATION_PATTERN.exec(duration);

  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(date.getTime() + value * multipliers[unit]);
}
