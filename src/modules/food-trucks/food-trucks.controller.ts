import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AddTruckImageDto } from './dto/add-truck-image.dto';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';
import { CreateFoodTruckDropDto } from './dto/create-food-truck-drop.dto';
import { CreateDraftFoodTruckDto } from './dto/create-draft-food-truck.dto';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { NearbyDropsQueryDto, TodaysDropsQueryDto } from './dto/drop-query.dto';
import { SetCuisinesDto } from './dto/set-cuisines.dto';
import { SetOperatingHoursDto } from './dto/set-operating-hours.dto';
import { SetupBasicMenuDto } from './dto/setup-basic-menu.dto';
import { SetupServiceAreaDto } from './dto/setup-service-area.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-availability-exception.dto';
import { UpdateDraftFoodTruckDto } from './dto/update-draft-food-truck.dto';
import { UpdateGuestCapacityDto } from './dto/update-guest-capacity.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateOperatingStatusDto } from './dto/update-operating-status.dto';
import { UpdateTruckLocationDto } from './dto/update-truck-location.dto';
import { UpdateTruckImageDto } from './dto/update-truck-image.dto';
import { FoodTrucksService } from './food-trucks.service';

@Controller('api/v1/food-trucks')
export class FoodTrucksController {
  constructor(private readonly foodTrucksService: FoodTrucksService) {}

  @Get('cuisines')
  listCuisineCategories() {
    return this.foodTrucksService.listCuisineCategories();
  }

  @Get('drops/nearby')
  getNearbyActiveDrops(@Query() query: NearbyDropsQueryDto) {
    return this.foodTrucksService.getNearbyActiveDrops(query);
  }

  @Get('drops/today')
  getTodaysDrops(@Query() query: TodaysDropsQueryDto) {
    return this.foodTrucksService.getTodaysDrops(query);
  }

  @Get('profile/:slug')
  getPublicProfile(@Param('slug') slug: string) {
    return this.foodTrucksService.getPublicProfile(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('mine')
  getMyFoodTrucks(@CurrentUser() user: AuthenticatedUser) {
    return this.foodTrucksService.getMyFoodTrucks(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('draft')
  createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDraftFoodTruckDto,
  ) {
    return this.foodTrucksService.createDraft(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/draft')
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: UpdateDraftFoodTruckDto,
  ) {
    return this.foodTrucksService.updateDraft(user.sub, foodTruckId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Put(':id/cuisines')
  setCuisines(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: SetCuisinesDto,
  ) {
    return this.foodTrucksService.setCuisines(user.sub, foodTruckId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post(':id/menus/basic')
  setupBasicMenu(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: SetupBasicMenuDto,
  ) {
    return this.foodTrucksService.setupBasicMenu(user.sub, foodTruckId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post(':id/menus/:menuId/categories')
  createMenuCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Param('menuId') menuId: string,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.foodTrucksService.createMenuCategory(
      user.sub,
      foodTruckId,
      menuId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/menu-categories/:categoryId')
  updateMenuCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.foodTrucksService.updateMenuCategory(
      user.sub,
      foodTruckId,
      categoryId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post(':id/menu-categories/:categoryId/items')
  createMenuItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.foodTrucksService.createMenuItem(
      user.sub,
      foodTruckId,
      categoryId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/menu-items/:itemId')
  updateMenuItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.foodTrucksService.updateMenuItem(
      user.sub,
      foodTruckId,
      itemId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/service-area')
  setupServiceArea(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: SetupServiceAreaDto,
  ) {
    return this.foodTrucksService.setupServiceArea(user.sub, foodTruckId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/guest-capacity')
  updateGuestCapacity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: UpdateGuestCapacityDto,
  ) {
    return this.foodTrucksService.updateGuestCapacity(user.sub, foodTruckId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/operating-status')
  updateOperatingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: UpdateOperatingStatusDto,
  ) {
    return this.foodTrucksService.updateOperatingStatus(
      user.sub,
      foodTruckId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/location')
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: UpdateTruckLocationDto,
  ) {
    return this.foodTrucksService.updateLocation(user.sub, foodTruckId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post(':id/drops')
  createActiveDrop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: CreateFoodTruckDropDto,
  ) {
    return this.foodTrucksService.createActiveDrop(user.sub, foodTruckId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post(':id/images')
  addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: AddTruckImageDto,
  ) {
    return this.foodTrucksService.addImage(user.sub, foodTruckId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/images/:imageId')
  updateImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateTruckImageDto,
  ) {
    return this.foodTrucksService.updateImage(user.sub, foodTruckId, imageId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Delete(':id/images/:imageId')
  removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.foodTrucksService.removeImage(user.sub, foodTruckId, imageId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Put(':id/operating-hours')
  setOperatingHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: SetOperatingHoursDto,
  ) {
    return this.foodTrucksService.setOperatingHours(user.sub, foodTruckId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post(':id/availability-exceptions')
  createAvailabilityException(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: CreateAvailabilityExceptionDto,
  ) {
    return this.foodTrucksService.createAvailabilityException(
      user.sub,
      foodTruckId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/availability-exceptions/:exceptionId')
  updateAvailabilityException(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() dto: UpdateAvailabilityExceptionDto,
  ) {
    return this.foodTrucksService.updateAvailabilityException(
      user.sub,
      foodTruckId,
      exceptionId,
      dto,
    );
  }
}
