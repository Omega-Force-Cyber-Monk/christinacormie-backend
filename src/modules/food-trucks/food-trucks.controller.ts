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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Food Trucks')
@Controller('api/v1/food-trucks')
export class FoodTrucksController {
  constructor(private readonly foodTrucksService: FoodTrucksService) {}

  @ApiOperation({ summary: 'List all cuisine categories' })
  @Get('cuisines')
  listCuisineCategories() {
    return this.foodTrucksService.listCuisineCategories();
  }

  @ApiOperation({ summary: 'Find active nearby food truck pop-up drops' })
  @Get('drops/nearby')
  getNearbyActiveDrops(@Query() query: NearbyDropsQueryDto) {
    return this.foodTrucksService.getNearbyActiveDrops(query);
  }

  @ApiOperation({ summary: "Get today's scheduled food truck drops" })
  @Get('drops/today')
  getTodaysDrops(@Query() query: TodaysDropsQueryDto) {
    return this.foodTrucksService.getTodaysDrops(query);
  }

  @ApiOperation({ summary: 'Get public food truck profile by slug' })
  @Get('profile/:slug')
  getPublicProfile(@Param('slug') slug: string) {
    return this.foodTrucksService.getPublicProfile(slug);
  }

  @ApiOperation({ summary: 'Get all food trucks owned by authenticated vendor' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('mine')
  getMyFoodTrucks(@CurrentUser() user: AuthenticatedUser) {
    return this.foodTrucksService.getMyFoodTrucks(user.sub);
  }

  @ApiOperation({ summary: 'Create a new draft food truck profile (Vendor)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('draft')
  createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDraftFoodTruckDto,
  ) {
    return this.foodTrucksService.createDraft(user.sub, dto);
  }

  @ApiOperation({ summary: 'Update draft food truck profile (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Set cuisines for a food truck (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Set up basic menu structure (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Create a menu category (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Update a menu category (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Create a menu item in a category (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Update a menu item (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Set service area radius and location (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Update maximum guest capacity (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Update operating status (OPEN/CLOSED) (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Update current live location (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Create an active pop-up drop (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Add a photo to food truck gallery (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Update a gallery photo (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Remove a photo from gallery (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Set weekly operating hours (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Create an availability exception date (Vendor)' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Update an availability exception date (Vendor)' })
  @ApiBearerAuth()
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
