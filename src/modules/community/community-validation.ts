import { BadRequestException } from '@nestjs/common';
import { CreateCommunityRequestDto } from './dto/create-community-request.dto';

export function validateCommunityPost(dto: CreateCommunityRequestDto) {
  for (const [key, value] of Object.entries(dto)) {
    if (value === null)
      throw new BadRequestException(
        `${key} cannot be null; omit optional fields instead`,
      );
  }
  dto.category ??= 'NEED_TRUCK';
  dto.title = dto.title?.trim();
  dto.description = dto.description?.trim();
  dto.address = dto.address?.trim();
  if (!dto.description)
    throw new BadRequestException('Please enter a post description');
  if (dto.category === 'FOR_SALE' && !dto.title)
    throw new BadRequestException('Item name is required for a For Sale post');
  if (dto.category === 'NEED_TRUCK') {
    for (const key of [
      'eventType',
      'eventDate',
      'startTime',
      'address',
      'guestCount',
    ] as const) {
      if (!dto[key])
        throw new BadRequestException(
          `${key} is required for a Need-a-Truck request`,
        );
    }
  }
  if (
    dto.category !== 'VENDOR_CALLOUT' &&
    [dto.spotsOpen, dto.attendanceMin, dto.attendanceMax].some(
      (v) => v !== undefined,
    )
  ) {
    throw new BadRequestException(
      'spotsOpen and attendance fields are only allowed for Vendor Callout posts',
    );
  }
  if (
    dto.attendanceMin !== undefined &&
    dto.attendanceMax !== undefined &&
    dto.attendanceMin > dto.attendanceMax
  ) {
    throw new BadRequestException('attendanceMin cannot exceed attendanceMax');
  }
  if ((dto.latitude === undefined) !== (dto.longitude === undefined))
    throw new BadRequestException(
      'latitude and longitude must be provided together',
    );
  if (
    dto.budgetMin !== undefined &&
    dto.budgetMax !== undefined &&
    dto.budgetMin > dto.budgetMax
  )
    throw new BadRequestException('budgetMin cannot exceed budgetMax');
  if (dto.startTime && dto.endTime && dto.startTime >= dto.endTime)
    throw new BadRequestException('endTime must be later than startTime');
  if (dto.expiresAt && new Date(dto.expiresAt) <= new Date())
    throw new BadRequestException('expiresAt must be in the future');
  if (
    dto.eventDate &&
    dto.eventDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
  )
    throw new BadRequestException('eventDate cannot be in the past');
  if (dto.eventTimezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: dto.eventTimezone });
    } catch {
      throw new BadRequestException(
        'eventTimezone must be a valid IANA time zone, for example America/Chicago',
      );
    }
  }
  if (dto.preferredMenuItems) {
    if (dto.preferredMenuItems.some((item) => !item.trim()))
      throw new BadRequestException('Preferred menu items cannot be blank');
    dto.preferredMenuItems = [
      ...new Set(dto.preferredMenuItems.map((item) => item.trim())),
    ];
  }
  validateCommunityMedia(dto.media ?? []);
  return dto;
}

export function validateCommunityMedia(
  media: { mediaUrl: string; mediaType: string }[],
) {
  if (media.length > 5)
    throw new BadRequestException(
      'A Community post can contain at most 5 attachments',
    );
  for (const item of media) {
    if (!['IMAGE', 'PDF'].includes(item.mediaType))
      throw new BadRequestException(
        'Community attachments must use mediaType IMAGE or PDF',
      );
    if (!item.mediaUrl.startsWith('https://'))
      throw new BadRequestException('Attachment URLs must use HTTPS');
  }
}
