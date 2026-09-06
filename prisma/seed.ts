import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export const FIXED_CUISINES = [
  {
    name: 'Tacos',
    slug: 'tacos',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f32e.png',
    pinColor: '#FFA500',
  },
  {
    name: 'Burgers',
    slug: 'burgers',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f354.png',
    pinColor: '#FF5722',
  },
  {
    name: 'Pizza',
    slug: 'pizza',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f355.png',
    pinColor: '#E91E63',
  },
  {
    name: 'Asian',
    slug: 'asian',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f35c.png',
    pinColor: '#9C27B0',
  },
  {
    name: 'BBQ',
    slug: 'bbq',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f356.png',
    pinColor: '#795548',
  },
  {
    name: 'Seafood',
    slug: 'seafood',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f99e.png',
    pinColor: '#00BCD4',
  },
  {
    name: 'Vegan',
    slug: 'vegan',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f957.png',
    pinColor: '#4CAF50',
  },
  {
    name: 'Desserts',
    slug: 'desserts',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f370.png',
    pinColor: '#FF4081',
  },
  {
    name: 'Sandwiches',
    slug: 'sandwiches',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f96a.png',
    pinColor: '#8D6E63',
  },
  {
    name: 'Indian',
    slug: 'indian',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f35b.png',
    pinColor: '#FF9800',
  },
  {
    name: 'Coffee',
    slug: 'coffee',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2615.png',
    pinColor: '#6D4C41',
  },
  {
    name: 'Smoothies',
    slug: 'smoothies',
    iconUrl:
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f964.png',
    pinColor: '#00E676',
  },
];

const DEMO_TRUCKS = [
  {
    name: 'Taco Paradise',
    slug: 'taco-paradise',
    truckCallName: 'Taco Paradise',
    averageRating: 4.8,
    totalReviews: 2103,
    totalBookings: 2847,
    followerCount: 9800,
    totalCheckIns: 1200,
    profileImageUrl:
      'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400',
    latitude: 37.7712,
    longitude: -122.4215,
    address: '500 Castro St, San Francisco, CA',
    cuisineSlug: 'tacos',
  },
  {
    name: 'Burger Bliss',
    slug: 'burger-bliss',
    truckCallName: 'Burger Bliss',
    averageRating: 4.9,
    totalReviews: 1234,
    totalBookings: 2156,
    followerCount: 12400,
    totalCheckIns: 1234,
    profileImageUrl:
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
    latitude: 37.778,
    longitude: -122.417,
    address: '100 Market St, San Francisco, CA',
    cuisineSlug: 'burgers',
  },
  {
    name: 'Pizza Wheels',
    slug: 'pizza-wheels',
    truckCallName: 'Pizza Wheels',
    averageRating: 4.9,
    totalReviews: 892,
    totalBookings: 1923,
    followerCount: 8200,
    totalCheckIns: 1234,
    profileImageUrl:
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400',
    latitude: 37.765,
    longitude: -122.422,
    address: '750 Valencia St, San Francisco, CA',
    cuisineSlug: 'pizza',
  },
  {
    name: 'Seoul Street',
    slug: 'seoul-street',
    truckCallName: 'Seoul Street',
    averageRating: 4.7,
    totalReviews: 756,
    totalBookings: 1542,
    followerCount: 6700,
    totalCheckIns: 1000,
    profileImageUrl:
      'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=400',
    latitude: 37.769,
    longitude: -122.43,
    address: '420 Church St, San Francisco, CA',
    cuisineSlug: 'asian',
  },
  {
    name: 'BBQ Bros',
    slug: 'bbq-bros',
    truckCallName: 'BBQ Bros',
    averageRating: 4.8,
    totalReviews: 489,
    totalBookings: 1234,
    followerCount: 5000,
    totalCheckIns: 900,
    profileImageUrl:
      'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400',
    latitude: 37.76,
    longitude: -122.415,
    address: '2400 Mission St, San Francisco, CA',
    cuisineSlug: 'bbq',
  },
  {
    name: 'Sushi Haven',
    slug: 'sushi-haven',
    truckCallName: 'Sushi Haven',
    averageRating: 4.7,
    totalReviews: 621,
    totalBookings: 900,
    followerCount: 5900,
    totalCheckIns: 900,
    profileImageUrl:
      'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400',
    latitude: 37.78,
    longitude: -122.425,
    address: '300 Hayes St, San Francisco, CA',
    cuisineSlug: 'asian',
  },
  {
    name: 'Vegan Vibes',
    slug: 'vegan-vibes',
    truckCallName: 'Vegan Vibes',
    averageRating: 4.6,
    totalReviews: 543,
    totalBookings: 800,
    followerCount: 4300,
    totalCheckIns: 600,
    profileImageUrl:
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
    latitude: 37.785,
    longitude: -122.41,
    address: '1200 Folsom St, San Francisco, CA',
    cuisineSlug: 'vegan',
  },
  {
    name: 'Seafood Splash',
    slug: 'seafood-splash',
    truckCallName: 'Seafood Splash',
    averageRating: 4.5,
    totalReviews: 380,
    totalBookings: 510,
    followerCount: 3200,
    totalCheckIns: 450,
    profileImageUrl:
      'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400',
    latitude: 37.776,
    longitude: -122.42,
    address: '200 Grove St, San Francisco, CA',
    cuisineSlug: 'seafood',
  },
  {
    name: 'Sweet Tooth Desserts',
    slug: 'sweet-tooth-desserts',
    truckCallName: 'Sweet Tooth',
    averageRating: 4.9,
    totalReviews: 640,
    totalBookings: 720,
    followerCount: 4100,
    totalCheckIns: 530,
    profileImageUrl:
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400',
    latitude: 37.7725,
    longitude: -122.4185,
    address: '350 11th St, San Francisco, CA',
    cuisineSlug: 'desserts',
  },
  {
    name: 'Morning Brew Truck',
    slug: 'morning-brew-truck',
    truckCallName: 'Morning Brew',
    averageRating: 4.7,
    totalReviews: 810,
    totalBookings: 990,
    followerCount: 5200,
    totalCheckIns: 780,
    profileImageUrl:
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400',
    latitude: 37.773,
    longitude: -122.423,
    address: '2200 Market St, San Francisco, CA',
    cuisineSlug: 'coffee',
  },
  {
    name: 'Austin Taco Trail',
    slug: 'austin-taco-trail',
    truckCallName: 'Austin Tacos',
    averageRating: 4.9,
    totalReviews: 1540,
    totalBookings: 2100,
    followerCount: 8900,
    totalCheckIns: 1100,
    profileImageUrl:
      'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400',
    latitude: 30.2672,
    longitude: -97.7431,
    address: '600 Congress Ave, Austin, TX',
    cuisineSlug: 'tacos',
  },
  {
    name: 'Lone Star Smokehouse',
    slug: 'lone-star-smokehouse',
    truckCallName: 'Lone Star BBQ',
    averageRating: 4.8,
    totalReviews: 920,
    totalBookings: 1430,
    followerCount: 6700,
    totalCheckIns: 850,
    profileImageUrl:
      'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400',
    latitude: 30.264,
    longitude: -97.738,
    address: '70 Rainey St, Austin, TX',
    cuisineSlug: 'bbq',
  },
];

async function main() {
  console.log('Seeding 12 fixed cuisines...');
  for (const cuisine of FIXED_CUISINES) {
    await prisma.cuisine.upsert({
      where: { slug: cuisine.slug },
      update: {
        name: cuisine.name,
        iconUrl: cuisine.iconUrl,
        pinColor: cuisine.pinColor,
        isActive: true,
      },
      create: {
        name: cuisine.name,
        slug: cuisine.slug,
        iconUrl: cuisine.iconUrl,
        pinColor: cuisine.pinColor,
        isActive: true,
      },
    });
  }
  console.log('Successfully seeded 12 fixed cuisines!');

  console.log('Seeding demo food trucks with locations & cuisines...');
  const defaultVendor = await prisma.vendor.findFirst();
  if (!defaultVendor) {
    console.warn('No vendor found. Please ensure users/vendors are seeded first.');
    return;
  }

  for (const item of DEMO_TRUCKS) {
    const truck = await prisma.foodTruck.upsert({
      where: { slug: item.slug },
      create: {
        vendorId: defaultVendor.id,
        name: item.name,
        slug: item.slug,
        truckCallName: item.truckCallName,
        description: `Top rated ${item.name} gourmet food truck`,
        status: 'ACTIVE',
        operatingStatus: 'OPEN',
        averageRating: item.averageRating,
        totalReviews: item.totalReviews,
        totalBookings: item.totalBookings,
        followerCount: item.followerCount,
        totalCheckIns: item.totalCheckIns,
        profileImageUrl: item.profileImageUrl,
        coverImageUrl: item.profileImageUrl,
      },
      update: {
        averageRating: item.averageRating,
        totalReviews: item.totalReviews,
        totalBookings: item.totalBookings,
        followerCount: item.followerCount,
        totalCheckIns: item.totalCheckIns,
        profileImageUrl: item.profileImageUrl,
      },
    });

    const safeAddress = item.address.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(
      `UPDATE food_trucks
       SET current_location = ST_SetSRID(ST_MakePoint(${item.longitude}, ${item.latitude}), 4326)::geography,
           current_address = '${safeAddress}',
           location_updated_at = NOW(),
           location_valid_until = NOW() + INTERVAL '365 days',
           operating_status = 'OPEN',
           status = 'ACTIVE'
       WHERE id = '${truck.id}'::uuid`,
    );

    const cuisine = await prisma.cuisine.findFirst({
      where: { slug: item.cuisineSlug },
    });
    if (cuisine) {
      await prisma.foodTruckCuisine.upsert({
        where: {
          foodTruckId_cuisineId: {
            foodTruckId: truck.id,
            cuisineId: cuisine.id,
          },
        },
        create: {
          foodTruckId: truck.id,
          cuisineId: cuisine.id,
          isPrimary: true,
        },
        update: {
          isPrimary: true,
        },
      });
    }

    const existingImage = await prisma.foodTruckImage.findFirst({
      where: { foodTruckId: truck.id },
    });
    if (!existingImage) {
      await prisma.foodTruckImage.create({
        data: {
          foodTruckId: truck.id,
          imageUrl: item.profileImageUrl,
          sortOrder: 1,
        },
      });
    }
  }
  console.log(`Successfully seeded ${DEMO_TRUCKS.length} food trucks with locations & cuisines!`);

  console.log('Seeding leaderboards for all 5 filter types...');
  const leaderboardTypes = [
    { type: 'TOP_RATED', title: 'Top Rated Food Trucks' },
    { type: 'MOST_BOOKED', title: 'Most Booked Food Trucks' },
    { type: 'MOST_VISITED', title: 'Most Visited Food Trucks' },
    { type: 'MOST_ENGAGED', title: 'Most Followed Food Trucks' },
    { type: 'TRENDING', title: 'Trending Food Trucks' },
    { type: 'RISING', title: 'Rising Food Trucks' },
  ] as const;

  for (const lbType of leaderboardTypes) {
    let rule = await prisma.leaderboardRule.findFirst({
      where: { type: lbType.type as any },
    });

    if (!rule) {
      rule = await prisma.leaderboardRule.create({
        data: {
          type: lbType.type as any,
          period: 'MONTHLY',
          bookingWeight: 1.0,
          ratingWeight: 1.0,
          reliabilityWeight: 1.0,
          engagementWeight: 1.0,
          checkInWeight: 1.0,
          algorithmVersion: '1.0',
          isActive: true,
        },
      });
    }

    let leaderboard = await prisma.leaderboard.findFirst({
      where: { ruleId: rule.id, isActive: true },
    });

    if (!leaderboard) {
      leaderboard = await prisma.leaderboard.create({
        data: {
          ruleId: rule.id,
          title: lbType.title,
          startsAt: new Date('2026-08-01'),
          endsAt: new Date('2026-08-31'),
          isActive: true,
          calculatedAt: new Date(),
        },
      });
    }

    const existingEntriesCount = await prisma.leaderboardEntry.count({
      where: { leaderboardId: leaderboard.id },
    });

    if (existingEntriesCount === 0) {
      const allTrucks = await prisma.foodTruck.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, vendorId: true, followerCount: true },
      });

      const sortedTrucks =
        lbType.type === 'MOST_ENGAGED'
          ? [...allTrucks].sort(
              (a, b) => (b.followerCount ?? 0) - (a.followerCount ?? 0),
            )
          : allTrucks;

      const entriesData = sortedTrucks.map((truck, idx) => ({
        leaderboardId: leaderboard.id,
        vendorId: truck.vendorId,
        foodTruckId: truck.id,
        rank: idx + 1,
        previousRank: idx + 1,
        score: 100 - idx * 5,
      }));

      await prisma.leaderboardEntry.createMany({
        data: entriesData,
      });
    }
  }
  console.log('Successfully seeded leaderboards!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

