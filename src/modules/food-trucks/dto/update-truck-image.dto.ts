import { PartialType } from '@nestjs/swagger';
import { AddTruckImageDto } from './add-truck-image.dto';

export class UpdateTruckImageDto extends PartialType(AddTruckImageDto) {}
