import { describe, expect, it } from "vitest";

import { addToCartSchema } from "../../src/tools/cartTools.js";
import { searchLocationsSchema } from "../../src/tools/locationTools.js";
import { searchProductsSchema } from "../../src/tools/productTools.js";

describe("location tool schema", () => {
  it("accepts each valid origin form", () => {
    expect(searchLocationsSchema.parse({ zipCode: "48201" }).zipCode).toBe("48201");
    expect(searchLocationsSchema.parse({ latLong: "42.3,-83.0" }).latLong).toBe("42.3,-83.0");
    expect(searchLocationsSchema.parse({ latitude: "42.3", longitude: "-83.0" }).latitude).toBe(
      "42.3"
    );
  });

  it("rejects missing, multiple, and incomplete origins", () => {
    expect(() => searchLocationsSchema.parse({})).toThrow();
    expect(() => searchLocationsSchema.parse({ zipCode: "48201", latLong: "42,-83" })).toThrow();
    expect(() => searchLocationsSchema.parse({ latitude: "42.3" })).toThrow();
  });
});

describe("product and cart tool schemas", () => {
  it("requires a product search term", () => {
    expect(() => searchProductsSchema.parse({ term: "" })).toThrow();
    expect(searchProductsSchema.parse({ term: "bread", start: 0, limit: 10 }).term).toBe("bread");
  });

  it("preserves UPC strings and validates cart quantities", () => {
    const parsed = addToCartSchema.parse({
      items: [{ upc: "0001111040101", quantity: 2, modality: "PICKUP" }]
    });
    expect(parsed.items[0]?.upc).toBe("0001111040101");
    expect(() => addToCartSchema.parse({ items: [] })).toThrow();
    expect(() =>
      addToCartSchema.parse({ items: [{ upc: "0001", quantity: 0, modality: "PICKUP" }] })
    ).toThrow();
    expect(() =>
      addToCartSchema.parse({ items: [{ upc: "12A", quantity: 1, modality: "PICKUP" }] })
    ).toThrow();
  });
});
