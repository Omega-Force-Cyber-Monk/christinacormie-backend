import { BadRequestException } from '@nestjs/common';

const DEFAULT_BOOKING_DURATION_MS = 3 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function bookingEventWindow(dto: {
  startsAt?: string;
  endsAt?: string;
  eventDate?: string;
  eventTime?: string;
  endTime?: string;
  eventTimezone?: string;
}) {
  if (dto.startsAt || dto.endsAt) {
    if (!dto.startsAt || !dto.endsAt) {
      throw new BadRequestException(
        'startsAt and endsAt must be provided together',
      );
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException(
        'startsAt and endsAt must be valid ISO date-time values',
      );
    }

    return { startsAt, endsAt };
  }

  if (!dto.eventDate || !dto.eventTime) {
    throw new BadRequestException(
      'eventDate and eventTime are required when startsAt and endsAt are not provided',
    );
  }

  if (!DATE_ONLY_PATTERN.test(dto.eventDate)) {
    throw new BadRequestException('eventDate must use YYYY-MM-DD format');
  }

  if (!TIME_ONLY_PATTERN.test(dto.eventTime)) {
    throw new BadRequestException('eventTime must use HH:mm 24-hour format');
  }

  if (dto.endTime && !TIME_ONLY_PATTERN.test(dto.endTime)) {
    throw new BadRequestException('endTime must use HH:mm 24-hour format');
  }

  const startsAt = localDateTimeToUtc(
    dto.eventDate,
    dto.eventTime,
    dto.eventTimezone,
  );
  const endsAt = dto.endTime
    ? localDateTimeToUtc(dto.eventDate, dto.endTime, dto.eventTimezone)
    : new Date(startsAt.getTime() + DEFAULT_BOOKING_DURATION_MS);

  return { startsAt, endsAt };
}

function localDateTimeToUtc(date: string, time: string, timezone?: string) {
  const targetWallTime = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(targetWallTime)) {
    throw new BadRequestException('Event date or time is invalid');
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone ?? 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    throw new BadRequestException(
      'eventTimezone must be a valid IANA time zone, for example America/Chicago',
    );
  }

  const formatAsWallTime = (timestamp: number) => {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .map((part) => [part.type, part.value]),
    );
    return Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
    );
  };

  let utcTime = targetWallTime;
  for (let i = 0; i < 3; i++) {
    utcTime += targetWallTime - formatAsWallTime(utcTime);
  }

  if (formatAsWallTime(utcTime) !== targetWallTime) {
    throw new BadRequestException(
      'Event time is invalid in the selected time zone because of a daylight-saving transition',
    );
  }

  return new Date(utcTime);
}
