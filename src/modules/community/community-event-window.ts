import { BadRequestException } from '@nestjs/common';

/** Request dates/times are wall-clock values in eventTimezone; legacy requests default to UTC. */
export function communityEventWindow(
  eventDate: Date | null,
  startTime: Date | null,
  endTime: Date | null,
  timezone?: string | null,
) {
  if (!eventDate || !startTime)
    throw new BadRequestException(
      'The request needs an event date and start time before a quote can be accepted',
    );
  const date = eventDate.toISOString().slice(0, 10);
  const localToUtc = (time: Date) => {
    const wall = new Date(
      `${date}T${time.toISOString().slice(11, 19)}Z`,
    ).getTime();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone ?? 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const asWall = (ms: number) => {
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
      );
      return Date.parse(
        `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
      );
    };
    let utc = wall;
    for (let i = 0; i < 3; i++) utc += wall - asWall(utc);
    if (asWall(utc) !== wall)
      throw new BadRequestException(
        'Event time is invalid in the selected time zone because of a daylight-saving transition',
      );
    return new Date(utc);
  };
  let startsAt: Date;
  let endsAt: Date;
  try {
    startsAt = localToUtc(startTime);
    // Figma only requires a start time. Reserve three hours unless an explicit end time was supplied.
    endsAt = endTime
      ? localToUtc(endTime)
      : new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('The request has an invalid event time zone');
  }
  if (startsAt <= new Date())
    throw new BadRequestException(
      'The event has already started; this quote can no longer be accepted',
    );
  if (endsAt <= startsAt)
    throw new BadRequestException(
      'Event end time must be later than the start time',
    );
  return { startsAt, endsAt };
}
