import { IsEnum } from 'class-validator';
import { AccountStatus } from '../../../common/enums/account-status.enum';

export class UpdateAccountStatusDto {
  @IsEnum(AccountStatus)
  status: AccountStatus;
}
