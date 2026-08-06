import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AccountStatus } from '../../../common/enums/account-status.enum';

export class UpdateAccountStatusDto {
  @ApiProperty({ enum: AccountStatus, example: AccountStatus.ACTIVE })
  @IsEnum(AccountStatus)
  status: AccountStatus;
}
