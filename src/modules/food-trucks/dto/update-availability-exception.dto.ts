import { PartialType } from '@nestjs/swagger';
import { CreateAvailabilityExceptionDto } from './create-availability-exception.dto';

export class UpdateAvailabilityExceptionDto extends PartialType(
  CreateAvailabilityExceptionDto,
) {}
