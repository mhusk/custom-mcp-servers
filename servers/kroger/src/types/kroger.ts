export type KrogerPagination = {
  total?: number;
  start?: number;
  limit?: number;
  [key: string]: unknown;
};

export type KrogerMeta = {
  pagination?: KrogerPagination;
  warnings?: unknown[];
  [key: string]: unknown;
};

export type KrogerEnvelope<T> = {
  data: T;
  meta?: KrogerMeta;
  [key: string]: unknown;
};

export type KrogerProduct = {
  productId?: string;
  upc?: string;
  brand?: string;
  description?: string;
  aisleLocations?: unknown[];
  items?: unknown[];
  images?: unknown[];
  [key: string]: unknown;
};

export type KrogerLocation = {
  locationId?: string;
  chain?: string;
  name?: string;
  address?: Record<string, unknown>;
  departments?: unknown[];
  [key: string]: unknown;
};

export type CartItem = {
  upc: string;
  quantity: number;
  modality: string;
};

export type LocationSearch = {
  zipCode?: string;
  latLong?: string;
  latitude?: string;
  longitude?: string;
  radiusInMiles?: number;
  limit?: number;
  chain?: string;
  departments?: string[];
};

export type ProductSearch = {
  term: string;
  locationId?: string;
  brand?: string;
  fulfillment?: string[];
  start?: number;
  limit?: number;
};
