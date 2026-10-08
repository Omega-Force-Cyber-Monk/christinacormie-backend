import { PartialType } from '@nestjs/swagger';
import { CreateCommunityRequestDto } from './create-community-request.dto';

export class UpdateCommunityRequestDto extends PartialType(
  CreateCommunityRequestDto,
) {}
