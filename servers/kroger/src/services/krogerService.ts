import type { KrogerClient } from "../clients/krogerClient.js";
import type { CartItem, LocationSearch, ProductSearch } from "../types/kroger.js";

export class KrogerService {
  constructor(
    private readonly client: KrogerClient,
    private readonly defaultLocationId?: string
  ) {}

  searchLocations(search: LocationSearch) {
    return this.client.searchLocations(search);
  }

  getLocation(locationId: string) {
    return this.client.getLocation(locationId);
  }

  searchProducts(search: ProductSearch) {
    return this.client.searchProducts({
      ...search,
      locationId: search.locationId ?? this.defaultLocationId
    });
  }

  getProduct(id: string, locationId?: string) {
    return this.client.getProduct(id, locationId ?? this.defaultLocationId);
  }

  addToCart(items: CartItem[]) {
    return this.client.addToCart(items);
  }
}
