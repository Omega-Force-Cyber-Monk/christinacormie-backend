import { PartialType } from '@nestjs/swagger';
import { CreateDraftFoodTruckDto } from './create-draft-food-truck.dto';

export class UpdateDraftFoodTruckDto extends PartialType(CreateDraftFoodTruckDto) {}
