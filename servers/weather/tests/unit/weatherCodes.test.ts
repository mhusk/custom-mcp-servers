import { expect, it } from "vitest";
import { weatherCodeDescription } from "../../src/weatherCodes.js";
const codes = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86,
  95, 96, 99
];
it.each(codes)("maps WMO code %s", (code) =>
  expect(weatherCodeDescription(code)).not.toBe("Unknown weather condition")
);
it("maps unknown codes safely", () =>
  expect(weatherCodeDescription(1234)).toBe("Unknown weather condition"));
