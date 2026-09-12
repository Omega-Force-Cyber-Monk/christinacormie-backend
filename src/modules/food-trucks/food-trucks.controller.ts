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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({
  statusCode,
  message,
  error,
});

const unauthorizedExample = errorExample(401, 'Unauthorized', 'Unauthorized');
const forbiddenVendorExample = errorExample(
  403,
  'Forbidden resource',
  'Forbidden',
);
const vendorApprovalErrorExample = errorExample(
  403,
  'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.',
  'Forbidden',
);

const cuisineExample = {
  id: 'cuisine-id',
  name: 'Mexican',
  slug: 'mexican',
  iconUrl: null,
  pinColor: '#FF5733',
};

const foodTruckExample = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  vendorId: '12441f40-2dc9-456d-948a-c33135359c70',
  marketId: null,
  name: 'Taco Paradise',
  truckCallName: 'Taco Paradise',
  truckType: 'FOOD_TRUCK',
  primaryCity: 'Austin',
  slug: 'taco-paradise',
  description: 'Authentic gourmet street tacos & fresh salsas',
  profileImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise.jpg',
  coverImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise-cover.jpg',
  status: 'ACTIVE',
  operatingStatus: 'OPEN',
  minimumBookingAmount: 300,
  maximumGuestCapacity: 100,
  currentAddress: '600 Congress Ave, Austin, TX 78701',
  locationUpdatedAt: '2026-09-08T06:00:00.000Z',
  locationValidUntil: '2026-09-08T10:00:00.000Z',
  averageRating: 4.8,
  totalReviews: 102,
  totalBookings: 12,
  totalCheckIns: 16500,
  followerCount: 12500,
  isFeatured: true,
  createdAt: '2026-09-08T05:50:00.000Z',
  updatedAt: '2026-09-08T06:00:00.000Z',
  images: [],
  cuisines: [{ cuisine: cuisineExample, isPrimary: true }],
  serviceAreas: [],
  menus: [],
};

const publicProfileExample = {
  ...foodTruckExample,
  vendor: {
    id: '12441f40-2dc9-456d-948a-c33135359c70',
    businessName: 'Taco Paradise',
    logoUrl: 'https://cdn.bitedrop.com/vendors/taco-paradise-logo.png',
    isVerified: true,
  },
  market: null,
  operatingHours: [],
  availabilityExceptions: [],
};

const dropExample = {
  id: 'drop-id',
  title: 'Flash Pop-Up Drop at Downtown Plaza',
  message: 'Serving hot tacos for the next 2 hours!',
  address: '600 Congress Ave, Austin, TX 78701',
  latitude: 30.2672,
  longitude: -97.7431,
  startsAt: '2026-09-08T06:00:00.000Z',
  endsAt: '2026-09-08T08:00:00.000Z',
  status: 'ACTIVE',
  distanceKm: 0.3,
  foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  foodTruckName: 'Taco Paradise',
  foodTruckSlug: 'taco-paradise',
  profileImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise.jpg',
  operatingStatus: 'OPEN',
  vendorBusinessName: 'Taco Paradise',
  vendorIsVerified: true,
};

const menuExample = {
  id: 'menu-id',
  foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  name: 'Main Daily Menu',
  description: 'Standard daily menu featuring tacos and drinks',
  isActive: true,
  categories: [
    {
      id: 'category-id',
      menuId: 'menu-id',
      name: 'Main Courses',
      description: 'Signature taco combos',
      sortOrder: 0,
      items: [
        {
          id: 'menu-item-id',
          categoryId: 'category-id',
          name: 'Birria Tacos',
          description: 'Slow-cooked braised beef tacos',
          imageUrl: 'https://cdn.bitedrop.com/menu/birria-tacos.jpg',
          price: 14.99,
          status: 'AVAILABLE',
          isVegetarian: false,
          isVegan: false,
          isGlutenFree: true,
          sortOrder: 0,
        },
      ],
    },
  ],
};

const categoryExample = menuExample.categories[0];
const menuItemExample = menuExample.categories[0].items[0];

const serviceAreaExample = {
  id: 'service-area-id',
  foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  name: 'Downtown Austin',
  centerAddress: '600 Congress Ave, Austin, TX 78701',
  latitude: 30.2672,
  longitude: -97.7431,
  radiusKm: 20,
  outsideRadiusAllowed: true,
  outsideRadiusFee: 25,
};

const imageExample = {
  id: 'image-id',
  foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  imageUrl: 'https://cdn.bitedrop.com/trucks/gallery-1.jpg',
  altText: 'Taco Paradise food truck',
  sortOrder: 0,
};

const operatingHoursExample = [
  {
    id: 'operating-hour-id',
    foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    dayOfWeek: 1,
    openingTime: '10:00',
    closingTime: '21:00',
    isClosed: false,
  },
];

const availabilityExceptionExample = {
  id: 'availability-exception-id',
  foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  exceptionDate: '2026-09-20',
  isAvailable: false,
  openingTime: null,
  closingTime: null,
  reason: 'Private catering event',
};

@ApiTags('Food Trucks')
@Controller('api/v1/food-trucks')
export class FoodTrucksController {
  constructor(private readonly foodTrucksService: FoodTrucksService) {}

  @ApiOperation({ summary: 'List all cuisine categories' })
  @ApiResponse({
    status: 200,
    description: 'Active cuisine categories returned successfully.',
    schema: { example: [cuisineExample] },
  })
  @Get('cuisines')
  listCuisineCategories() {
    return this.foodTrucksService.listCuisineCategories();
  }

  @ApiOperation({ summary: 'Find active nearby food truck pop-up drops' })
  @ApiResponse({
    status: 200,
    description:
      'Nearby active drops from active trucks and approved vendors returned successfully.',
    schema: { example: [dropExample] },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['latitude must be a latitude string or number'],
        'Bad Request',
      ),
    },
  })
  @Get('drops/nearby')
  getNearbyActiveDrops(@Query() query: NearbyDropsQueryDto) {
    return this.foodTrucksService.getNearbyActiveDrops(query);
  }

  @ApiOperation({ summary: "Get today's scheduled food truck drops" })
  @ApiResponse({
    status: 200,
    description:
      "Today's scheduled drops from active trucks and approved vendors returned successfully.",
    schema: { example: [dropExample] },
  })
  @ApiResponse({
    status: 400,
    description:
      'latitude/longitude pair is incomplete, radius is used without coordinates, or query validation failed.',
    schema: {
      example: errorExample(
        400,
        'latitude and longitude must be provided together',
        'Bad Request',
      ),
    },
  })
  @Get('drops/today')
  getTodaysDrops(@Query() query: TodaysDropsQueryDto) {
    return this.foodTrucksService.getTodaysDrops(query);
  }

  @ApiOperation({ summary: 'Get public food truck profile by slug' })
  @ApiResponse({
    status: 200,
    description:
      'Public profile returned for an active food truck with approved vendor.',
    schema: { example: publicProfileExample },
  })
  @ApiResponse({
    status: 404,
    description:
      'Food truck was not found, inactive, deleted, or vendor is not approved.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @Get('profile/:slug')
  getPublicProfile(@Param('slug') slug: string) {
    return this.foodTrucksService.getPublicProfile(slug);
  }

  @ApiOperation({
    summary: 'Get all food trucks owned by authenticated vendor',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Authenticated vendor food trucks returned successfully.',
    schema: { example: [foodTruckExample] },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user does not have vendor role.',
    schema: { example: forbiddenVendorExample },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('mine')
  getMyFoodTrucks(@CurrentUser() user: AuthenticatedUser) {
    return this.foodTrucksService.getMyFoodTrucks(user.sub);
  }

  @ApiOperation({ summary: 'Create a new draft food truck profile (Vendor)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Draft food truck profile created successfully.',
    schema: { example: { ...foodTruckExample, status: 'DRAFT' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['name must be shorter than or equal to 255 characters'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Vendor profile is missing or user is not a vendor.',
    schema: {
      example: errorExample(403, 'Vendor profile is required', 'Forbidden'),
    },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Draft food truck profile updated successfully.',
    schema: { example: { ...foodTruckExample, status: 'DRAFT' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['profileImageUrl must be a URL address'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Food truck does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Food truck cuisines saved successfully.',
    schema: {
      example: [
        {
          foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          cuisineId: 'cuisine-id',
          isPrimary: true,
          cuisine: cuisineExample,
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cuisine list is empty or an item has no cuisineId/name.',
    schema: {
      example: errorExample(
        400,
        'At least one cuisine is required',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Food truck does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 201,
    description: 'Basic menu structure created successfully.',
    schema: { example: menuExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Menu categories are empty, category items are empty, or body validation failed.',
    schema: {
      example: errorExample(
        400,
        'At least one menu category is required',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Food truck does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 201,
    description: 'Menu category created successfully.',
    schema: { example: categoryExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['name must be shorter than or equal to 150 characters'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Menu or food truck belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Menu does not belong to this food truck',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck or menu was not found.',
    schema: { example: errorExample(404, 'Menu not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Menu category updated successfully.',
    schema: { example: categoryExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['sortOrder must not be less than 0'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Menu category belongs to another food truck/vendor.',
    schema: {
      example: errorExample(
        403,
        'Menu category does not belong to this food truck',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Menu category was not found.',
    schema: {
      example: errorExample(404, 'Menu category not found', 'Not Found'),
    },
  })
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
  @ApiResponse({
    status: 201,
    description: 'Menu item created successfully.',
    schema: { example: menuItemExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['price must not be less than 0'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Menu category belongs to another food truck/vendor.',
    schema: {
      example: errorExample(
        403,
        'Menu category does not belong to this food truck',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Menu category was not found.',
    schema: {
      example: errorExample(404, 'Menu category not found', 'Not Found'),
    },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Menu item updated successfully.',
    schema: { example: { ...menuItemExample, status: 'SOLD_OUT' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        [
          'status must be one of the following values: AVAILABLE, UNAVAILABLE, SOLD_OUT',
        ],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Menu item belongs to another food truck/vendor.',
    schema: {
      example: errorExample(
        403,
        'Menu item does not belong to this food truck',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Menu item was not found.',
    schema: { example: errorExample(404, 'Menu item not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Food truck service area saved successfully.',
    schema: { example: serviceAreaExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['radiusKm must not be less than 0.1'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Food truck does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 200,
    description:
      'Guest capacity or minimum booking amount updated successfully.',
    schema: {
      example: {
        ...foodTruckExample,
        maximumGuestCapacity: 200,
        minimumBookingAmount: 500,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['maximumGuestCapacity must not be less than 1'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Food truck does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/guest-capacity')
  updateGuestCapacity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Body() dto: UpdateGuestCapacityDto,
  ) {
    return this.foodTrucksService.updateGuestCapacity(
      user.sub,
      foodTruckId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Update operating status (OPEN/CLOSED) (Vendor)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Operating status updated successfully.',
    schema: { example: { ...foodTruckExample, operatingStatus: 'OPEN' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        [
          'operatingStatus must be one of the following values: OPEN, CLOSED, BUSY, UNAVAILABLE',
        ],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'Vendor account is not approved or food truck belongs to another vendor.',
    schema: { example: vendorApprovalErrorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Current live location updated successfully.',
    schema: {
      example: {
        ...foodTruckExample,
        currentAddress: '100 Congress Ave, Austin, TX 78701',
        locationValidUntil: '2026-09-08T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['validForMinutes must not be greater than 1440'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'Vendor account is not approved or food truck belongs to another vendor.',
    schema: { example: vendorApprovalErrorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 201,
    description: 'Active food truck drop created successfully.',
    schema: { example: dropExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['durationMinutes must not be greater than 1440'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'Vendor account is not approved or food truck belongs to another vendor.',
    schema: { example: vendorApprovalErrorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 201,
    description: 'Food truck gallery photo added successfully.',
    schema: { example: imageExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['imageUrl must be a URL address'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Food truck does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Food truck gallery photo updated successfully.',
    schema: { example: { ...imageExample, altText: 'Updated gallery image' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['sortOrder must not be less than 0'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Image belongs to another food truck/vendor.',
    schema: {
      example: errorExample(
        403,
        'Image does not belong to this food truck',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck image or food truck was not found.',
    schema: {
      example: errorExample(404, 'Food truck image not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':id/images/:imageId')
  updateImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') foodTruckId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateTruckImageDto,
  ) {
    return this.foodTrucksService.updateImage(
      user.sub,
      foodTruckId,
      imageId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Remove a photo from gallery (Vendor)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Food truck gallery photo removed successfully.',
    schema: { example: imageExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Image belongs to another food truck/vendor.',
    schema: {
      example: errorExample(
        403,
        'Image does not belong to this food truck',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck image or food truck was not found.',
    schema: {
      example: errorExample(404, 'Food truck image not found', 'Not Found'),
    },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Weekly operating hours saved successfully.',
    schema: { example: operatingHoursExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Operating hours are duplicated, open day is missing time, or body validation failed.',
    schema: {
      example: errorExample(
        400,
        'Operating hours contain duplicate days',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Food truck does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 201,
    description: 'Availability exception created successfully.',
    schema: { example: availabilityExceptionExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['exceptionDate must be a valid ISO 8601 date string'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Food truck does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Availability exception updated successfully.',
    schema: {
      example: {
        ...availabilityExceptionExample,
        reason: 'Updated exception reason',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        [
          'openingTime must match /^([01]\\d|2[0-3]):[0-5]\\d$/ regular expression',
        ],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Availability exception belongs to another food truck/vendor.',
    schema: {
      example: errorExample(
        403,
        'Availability exception does not belong to this food truck',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Availability exception or food truck was not found.',
    schema: {
      example: errorExample(
        404,
        'Availability exception not found',
        'Not Found',
      ),
    },
  })
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
