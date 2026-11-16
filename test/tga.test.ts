import { describe, expect, test } from "bun:test";
import { decodeTga } from "../scripts/tga.ts";

function file(type: number, top: boolean, rle = false): Uint8Array {
  const header = new Uint8Array(18);
  header[2] = type;
  header[12] = 2;
  header[14] = 2;
  header[16] = 24;
  header[17] = top ? 0x20 : 0;
  const pixel = [0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255];
  const ordered = top ? pixel : [...pixel.slice(6), ...pixel.slice(0, 6)];
  const encoded = rle ? [0x03, ...ordered] : ordered;
  const data = new Uint8Array([...header, ...encoded]);
  return data;
}

describe("TGA decoding", () => {
  test("decodes raw and RLE pixels in both vertical origins", () => {
    for (const top of [false, true]) {
      const expected = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255];
      expect([...decodeTga(file(2, top)).pixels]).toEqual(expected);
      expect([...decodeTga(file(10, top, true)).pixels]).toEqual(expected);
    }
  });
});
