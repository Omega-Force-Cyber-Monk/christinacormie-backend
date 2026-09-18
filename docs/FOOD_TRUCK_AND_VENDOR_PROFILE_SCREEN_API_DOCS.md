# API & Response

## GET `/api/v1/food-trucks/profile/:slug`

```json
{
  "id": "6df466d9-23d6-4483-9507-1fa75225f244",
  "vendorId": "12441f40-2dc9-456d-948a-c33135359c70",
  "marketId": null,
  "name": "Taco Paradise",
  "slug": "taco-paradise",
  "truckCallName": "Taco Paradise Express",
  "truckType": "FOOD_TRUCK",
  "primaryCity": "Austin",
  "description": "Authentic gourmet Mexican street tacos with scratch-made salsas",
  "profileImageUrl": "https://cdn.bitedrop.com/trucks/taco-paradise.jpg",
  "coverImageUrl": "https://cdn.bitedrop.com/trucks/taco-paradise-cover.jpg",
  "status": "ACTIVE",
  "operatingStatus": "OPEN",
  "minimumBookingAmount": 300,
  "maximumGuestCapacity": 200,
  "currentAddress": "Union Square, SF",
  "locationUpdatedAt": "2026-09-18T08:00:00.000Z",
  "locationValidUntil": "2026-09-18T12:00:00.000Z",
  "averageRating": 4.9,
  "totalReviews": 102,
  "totalBookings": 28,
  "totalCheckIns": 1650,
  "followerCount": 1240,
  "isFeatured": true,
  "createdAt": "2026-09-08T05:50:00.000Z",
  "updatedAt": "2026-09-18T08:00:00.000Z",
  "vendor": {
    "id": "12441f40-2dc9-456d-948a-c33135359c70",
    "businessName": "Taco Paradise",
    "logoUrl": "https://cdn.bitedrop.com/vendors/taco-paradise-logo.png",
    "isVerified": true,
    "reliabilityScore": "98.50"
  },
  "market": null,
  "images": [],
  "cuisines": [
    {
      "isPrimary": true,
      "cuisine": {
        "id": "cuisine-1",
        "name": "Mexican Street Food",
        "slug": "mexican-street-food",
        "iconUrl": "https://cdn.bitedrop.com/icons/taco.png",
        "pinColor": "#FFA500"
      }
    }
  ],
  "menus": [
    {
      "id": "menu-id-1",
      "name": "Daily Service Menu",
      "description": "Standard daily menu",
      "isActive": true,
      "categories": [
        {
          "id": "cat-id-1",
          "name": "Signature Tacos",
          "description": "Served with homemade corn tortillas and fresh cilantro",
          "sortOrder": 0,
          "items": [
            {
              "id": "item-1",
              "name": "Slow-Braised Birria Tacos",
              "description": "3 crispy beef birria tacos with rich consommé dip",
              "imageUrl": "https://cdn.bitedrop.com/menu/birria.jpg",
              "price": "14.99",
              "status": "AVAILABLE",
              "isVegetarian": false,
              "isVegan": false,
              "isGlutenFree": true,
              "sortOrder": 0
            },
            {
              "id": "item-2",
              "name": "Baja Crispy Fish Taco",
              "description": "Beer-battered cod with chipotle crema and fresh cabbage",
              "imageUrl": "https://cdn.bitedrop.com/menu/fish-taco.jpg",
              "price": "13.50",
              "status": "AVAILABLE",
              "isVegetarian": false,
              "isVegan": false,
              "isGlutenFree": false,
              "sortOrder": 1
            }
          ]
        }
      ]
    }
  ],
  "serviceAreas": [
    {
      "id": "area-1",
      "name": "Austin Metro",
      "centerAddress": "Union Square, SF",
      "radiusKm": "25.00",
      "isActive": true
    }
  ],
  "operatingHours": [
    {
      "dayOfWeek": 5,
      "openTime": "11:00",
      "closeTime": "21:00",
      "isClosed": false
    }
  ],
  "availabilityExceptions": []
}
```

---

## GET `/api/v1/promotions/food-trucks/:foodTruckId`

```json
[
  {
    "id": "promo-id-1",
    "foodTruckId": "6df466d9-23d6-4483-9507-1fa75225f244",
    "title": "20% off all orders before 2PM",
    "description": "Get 20% off lunch orders placed between 11AM and 2PM",
    "type": "PERCENTAGE",
    "value": 20,
    "couponCode": "LUNCH20",
    "minimumSpend": 15,
    "maximumDiscount": 10,
    "isFollowerOnly": false,
    "usageLimit": 100,
    "startsAt": "2026-09-01T00:00:00.000Z",
    "endsAt": "2026-09-30T23:59:59.000Z",
    "isActive": true,
    "createdAt": "2026-09-01T00:00:00.000Z",
    "updatedAt": "2026-09-01T00:00:00.000Z",
    "foodTruck": {
      "id": "6df466d9-23d6-4483-9507-1fa75225f244",
      "name": "Taco Paradise",
      "slug": "taco-paradise",
      "profileImageUrl": "https://cdn.bitedrop.com/trucks/taco-paradise.jpg",
      "operatingStatus": "OPEN"
    },
    "_count": {
      "redemptions": 34
    }
  }
]
```

---

## GET `/api/v1/social/posts/mine`

```json
{
  "items": [
    {
      "id": "post-id-1",
      "vendorId": "12441f40-2dc9-456d-948a-c33135359c70",
      "foodTruckId": "6df466d9-23d6-4483-9507-1fa75225f244",
      "content": "Fresh grilled chicken and veggie skewers ready at Union Square today!",
      "status": "PUBLISHED",
      "isPromotion": false,
      "isFollowerOnly": false,
      "likeCount": 54,
      "commentCount": 12,
      "shareCount": 8,
      "saveCount": 9,
      "isLiked": true,
      "isSaved": false,
      "createdAt": "2026-09-18T10:30:00.000Z",
      "media": [
        {
          "id": "media-1",
          "mediaType": "IMAGE",
          "mediaUrl": "https://cdn.bitedrop.com/posts/chicken-skewers.jpg",
          "sortOrder": 0
        }
      ],
      "vendor": {
        "id": "12441f40-2dc9-456d-948a-c33135359c70",
        "businessName": "Taco Paradise",
        "logoUrl": "https://cdn.bitedrop.com/vendors/taco-paradise-logo.png",
        "isVerified": true
      },
      "foodTruck": {
        "id": "6df466d9-23d6-4483-9507-1fa75225f244",
        "name": "Taco Paradise",
        "slug": "taco-paradise",
        "profileImageUrl": "https://cdn.bitedrop.com/trucks/taco-paradise.jpg",
        "operatingStatus": "OPEN"
      }
    },
    {
      "id": "post-id-2",
      "vendorId": "12441f40-2dc9-456d-948a-c33135359c70",
      "foodTruckId": "6df466d9-23d6-4483-9507-1fa75225f244",
      "content": "Signature penne arrabbiata pasta box served piping hot!",
      "status": "PUBLISHED",
      "isPromotion": true,
      "isFollowerOnly": false,
      "likeCount": 42,
      "commentCount": 6,
      "shareCount": 5,
      "saveCount": 4,
      "isLiked": false,
      "isSaved": true,
      "createdAt": "2026-09-17T15:10:00.000Z",
      "media": [
        {
          "id": "media-2",
          "mediaType": "IMAGE",
          "mediaUrl": "https://cdn.bitedrop.com/posts/penne-pasta.jpg",
          "sortOrder": 0
        }
      ],
      "vendor": {
        "id": "12441f40-2dc9-456d-948a-c33135359c70",
        "businessName": "Taco Paradise",
        "logoUrl": "https://cdn.bitedrop.com/vendors/taco-paradise-logo.png",
        "isVerified": true
      },
      "foodTruck": {
        "id": "6df466d9-23d6-4483-9507-1fa75225f244",
        "name": "Taco Paradise",
        "slug": "taco-paradise",
        "profileImageUrl": "https://cdn.bitedrop.com/trucks/taco-paradise.jpg",
        "operatingStatus": "OPEN"
      }
    }
  ],
  "nextCursor": null
}
```

---

## GET `/api/v1/food-trucks/profile/:slug/reviews`

```json
{
  "summary": {
    "averageRating": 4.9,
    "totalReviews": 102
  },
  "items": [
    {
      "id": "rev-1",
      "rating": 5,
      "title": "Best tacos in town!",
      "content": "Best tacos in SF! The fish taco is absolutely incredible.",
      "isVerified": true,
      "vendorResponse": null,
      "vendorRespondedAt": null,
      "createdAt": "2026-09-16T18:45:00.000Z",
      "customer": {
        "id": "cust-1",
        "name": "Sarah Johnson",
        "avatarUrl": "https://cdn.bitedrop.com/avatars/sarah.jpg"
      }
    },
    {
      "id": "rev-2",
      "rating": 5,
      "title": "Loved the Ambiance",
      "content": "The new sushi place is a game changer! Fresh ingredients and great ambiance.",
      "isVerified": true,
      "vendorResponse": "Thank you so much Michael! Looking forward to serving you again.",
      "vendorRespondedAt": "2026-09-15T15:00:00.000Z",
      "customer": {
        "id": "cust-2",
        "name": "Michael Lee",
        "avatarUrl": "https://cdn.bitedrop.com/avatars/michael.jpg"
      }
    }
  ],
  "nextCursor": null
}
```
