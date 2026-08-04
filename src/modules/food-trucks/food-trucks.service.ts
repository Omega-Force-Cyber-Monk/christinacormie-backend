import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
import { FoodTrucksRepository } from './food-trucks.repository';

@Injectable()
export class FoodTrucksService {
  constructor(private readonly foodTrucksRepository: FoodTrucksRepository) {}

  async getPublicProfile(slug: string) {
    const foodTruck = await this.foodTrucksRepository.findPublicBySlug(slug);

    if (!foodTruck) {
      throw new NotFoundException('Food truck not found');
    }

    return foodTruck;
  }

  listCuisineCategories() {
    return this.foodTrucksRepository.listCuisines();
  }

  getNearbyActiveDrops(dto: NearbyDropsQueryDto) {
    return this.foodTrucksRepository.findNearbyActiveDrops(dto);
  }

  getTodaysDrops(dto: TodaysDropsQueryDto) {
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('latitude and longitude must be provided together');
    }

    if (dto.radiusKm !== undefined && (!hasLatitude || !hasLongitude)) {
      throw new BadRequestException('radiusKm requires latitude and longitude');
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return this.foodTrucksRepository.findTodaysDrops(dto, startOfDay, endOfDay);
  }

  async getMyFoodTrucks(userId: string) {
    const vendor = await this.getVendorForUser(userId);
    return this.foodTrucksRepository.findMine(vendor.id);
  }

  async createDraft(userId: string, dto: CreateDraftFoodTruckDto) {
    const vendor = await this.getVendorForUser(userId);
    return this.foodTrucksRepository.createDraft(vendor.id, dto);
  }

  async updateDraft(userId: string, foodTruckId: string, dto: UpdateDraftFoodTruckDto) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    return this.foodTrucksRepository.updateDraft(foodTruckId, dto);
  }

  async setCuisines(userId: string, foodTruckId: string, dto: SetCuisinesDto) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);

    if (!dto.cuisines.length) {
      throw new BadRequestException('At least one cuisine is required');
    }

    for (const cuisine of dto.cuisines) {
      if (!cuisine.cuisineId && !cuisine.name) {
        throw new BadRequestException('Each cuisine needs either cuisineId or name');
      }
    }

    return this.foodTrucksRepository.setCuisines(foodTruckId, dto.cuisines);
  }

  async setupBasicMenu(userId: string, foodTruckId: string, dto: SetupBasicMenuDto) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);

    if (!dto.categories.length) {
      throw new BadRequestException('At least one menu category is required');
    }

    for (const category of dto.categories) {
      if (!category.items.length) {
        throw new BadRequestException('Each menu category needs at least one item');
      }
    }

    return this.foodTrucksRepository.setupBasicMenu(foodTruckId, dto);
  }

  async setupServiceArea(userId: string, foodTruckId: string, dto: SetupServiceAreaDto) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    return this.foodTrucksRepository.setupServiceArea(foodTruckId, dto);
  }

  async updateGuestCapacity(
    userId: string,
    foodTruckId: string,
    dto: UpdateGuestCapacityDto,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    return this.foodTrucksRepository.updateGuestCapacity(foodTruckId, dto);
  }

  async updateOperatingStatus(
    userId: string,
    foodTruckId: string,
    dto: UpdateOperatingStatusDto,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    return this.foodTrucksRepository.updateOperatingStatus(foodTruckId, dto);
  }

  async updateLocation(
    userId: string,
    foodTruckId: string,
    dto: UpdateTruckLocationDto,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    return this.foodTrucksRepository.updateLocation(foodTruckId, dto);
  }

  async createActiveDrop(
    userId: string,
    foodTruckId: string,
    dto: CreateFoodTruckDropDto,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    return this.foodTrucksRepository.createActiveDrop(foodTruckId, dto);
  }

  async addImage(userId: string, foodTruckId: string, dto: AddTruckImageDto) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    return this.foodTrucksRepository.addImage(foodTruckId, dto);
  }

  async updateImage(
    userId: string,
    foodTruckId: string,
    imageId: string,
    dto: UpdateTruckImageDto,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    const image = await this.foodTrucksRepository.findImageById(imageId);

    if (!image) {
      throw new NotFoundException('Food truck image not found');
    }

    if (image.foodTruckId !== foodTruckId) {
      throw new ForbiddenException('Image does not belong to this food truck');
    }

    return this.foodTrucksRepository.updateImage(imageId, dto);
  }

  async removeImage(userId: string, foodTruckId: string, imageId: string) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    const image = await this.foodTrucksRepository.findImageById(imageId);

    if (!image) {
      throw new NotFoundException('Food truck image not found');
    }

    if (image.foodTruckId !== foodTruckId) {
      throw new ForbiddenException('Image does not belong to this food truck');
    }

    return this.foodTrucksRepository.removeImage(imageId);
  }

  async createMenuCategory(
    userId: string,
    foodTruckId: string,
    menuId: string,
    dto: CreateMenuCategoryDto,
  ) {
    await this.ensureOwnMenu(userId, foodTruckId, menuId);
    return this.foodTrucksRepository.createMenuCategory(menuId, dto);
  }

  async updateMenuCategory(
    userId: string,
    foodTruckId: string,
    categoryId: string,
    dto: UpdateMenuCategoryDto,
  ) {
    await this.ensureOwnMenuCategory(userId, foodTruckId, categoryId);
    return this.foodTrucksRepository.updateMenuCategory(categoryId, dto);
  }

  async createMenuItem(
    userId: string,
    foodTruckId: string,
    categoryId: string,
    dto: CreateMenuItemDto,
  ) {
    await this.ensureOwnMenuCategory(userId, foodTruckId, categoryId);
    return this.foodTrucksRepository.createMenuItem(categoryId, dto);
  }

  async updateMenuItem(
    userId: string,
    foodTruckId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
  ) {
    await this.ensureOwnMenuItem(userId, foodTruckId, itemId);
    return this.foodTrucksRepository.updateMenuItem(itemId, dto);
  }

  async setOperatingHours(
    userId: string,
    foodTruckId: string,
    dto: SetOperatingHoursDto,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);

    const days = new Set<number>();
    for (const hour of dto.hours) {
      if (days.has(hour.dayOfWeek)) {
        throw new BadRequestException('Operating hours contain duplicate days');
      }

      if (!hour.isClosed && (!hour.openingTime || !hour.closingTime)) {
        throw new BadRequestException('Open days need opening and closing times');
      }

      days.add(hour.dayOfWeek);
    }

    return this.foodTrucksRepository.setOperatingHours(foodTruckId, dto);
  }

  async createAvailabilityException(
    userId: string,
    foodTruckId: string,
    dto: CreateAvailabilityExceptionDto,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    return this.foodTrucksRepository.createAvailabilityException(foodTruckId, dto);
  }

  async updateAvailabilityException(
    userId: string,
    foodTruckId: string,
    exceptionId: string,
    dto: UpdateAvailabilityExceptionDto,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    const exception =
      await this.foodTrucksRepository.findAvailabilityExceptionById(exceptionId);

    if (!exception) {
      throw new NotFoundException('Availability exception not found');
    }

    if (exception.foodTruckId !== foodTruckId) {
      throw new ForbiddenException(
        'Availability exception does not belong to this food truck',
      );
    }

    return this.foodTrucksRepository.updateAvailabilityException(exceptionId, dto);
  }

  private async getVendorForUser(userId: string) {
    const vendor = await this.foodTrucksRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    return vendor;
  }

  private async ensureOwnFoodTruck(userId: string, foodTruckId: string) {
    const vendor = await this.getVendorForUser(userId);
    const foodTruck = await this.foodTrucksRepository.findById(foodTruckId);

    if (!foodTruck) {
      throw new NotFoundException('Food truck not found');
    }

    if (foodTruck.vendorId !== vendor.id) {
      throw new ForbiddenException('Food truck does not belong to this vendor');
    }

    return foodTruck;
  }

  private async ensureOwnMenu(userId: string, foodTruckId: string, menuId: string) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    const menu = await this.foodTrucksRepository.findMenuById(menuId);

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    if (menu.foodTruckId !== foodTruckId) {
      throw new ForbiddenException('Menu does not belong to this food truck');
    }

    return menu;
  }

  private async ensureOwnMenuCategory(
    userId: string,
    foodTruckId: string,
    categoryId: string,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    const category = await this.foodTrucksRepository.findMenuCategoryById(categoryId);

    if (!category) {
      throw new NotFoundException('Menu category not found');
    }

    if (category.menu.foodTruckId !== foodTruckId) {
      throw new ForbiddenException(
        'Menu category does not belong to this food truck',
      );
    }

    return category;
  }

  private async ensureOwnMenuItem(
    userId: string,
    foodTruckId: string,
    itemId: string,
  ) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    const item = await this.foodTrucksRepository.findMenuItemById(itemId);

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    if (item.category.menu.foodTruckId !== foodTruckId) {
      throw new ForbiddenException('Menu item does not belong to this food truck');
    }

    return item;
  }
}
