export interface ApiRestaurantPhoto {
  url: string;
  source?: string;
}

export interface ApiRestaurant {
  id: string;
  source: string;
  name: string;
  location: {
    address: string;
    township: string;
    lat: number | null;
    lng: number | null;
  };
  hours: string;
  phone: string;
  dishes: string[];
  reviews: {
    rating: number | null;
    count: number | null;
    summary: string;
  };
  priceRange: "$" | "$$" | "$$$" | null;
  photos: ApiRestaurantPhoto[];
  menuPhotos: ApiRestaurantPhoto[];
}

export interface RestaurantsApiResponse {
  data: ApiRestaurant[];
  meta: {
    requestedSources: string[];
    errorCount: number;
    errors: Array<{ source: string; status: number; message: string }>;
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}

export interface TownshipsApiResponse {
  data: string[];
}
