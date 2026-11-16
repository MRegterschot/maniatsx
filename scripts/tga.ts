export function decodeTga(data: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  if (data.length < 18) throw new Error("Invalid TGA header");
  const idLength = data[0]!;
  const type = data[2]!;
  const width = data[12]! | (data[13]! << 8);
  const height = data[14]! | (data[15]! << 8);
  const bpp = data[16]!;
  if (![2, 10].includes(type) || ![24, 32].includes(bpp) || !width || !height)
    throw new Error("Unsupported TGA format (expected type 2/10, 24/32 bpp)");
  const bytes = bpp / 8;
  let offset = 18 + idLength;
  const pixels = new Uint8Array(width * height * 4);
  let written = 0;
  const put = (pixel: Uint8Array) => {
    const source = written++;
    const sx = source % width;
    const sy = Math.floor(source / width);
    const x = data[17]! & 0x10 ? width - 1 - sx : sx;
    const y = data[17]! & 0x20 ? sy : height - 1 - sy;
    const target = (y * width + x) * 4;
    pixels[target] = pixel[2]!;
    pixels[target + 1] = pixel[1]!;
    pixels[target + 2] = pixel[0]!;
    pixels[target + 3] = bytes === 4 ? pixel[3]! : 255;
  };
  const readPixel = () => {
    if (offset + bytes > data.length) throw new Error("Truncated TGA pixel data");
    const p = data.slice(offset, offset + bytes);
    offset += bytes;
    return p;
  };
  if (type === 2) while (written < width * height) put(readPixel());
  else
    while (written < width * height) {
      if (offset >= data.length) throw new Error("Truncated TGA RLE data");
      const packet = data[offset++]!;
      const count = (packet & 0x7f) + 1;
      if (written + count > width * height) throw new Error("TGA RLE packet exceeds image size");
      if (packet & 0x80) {
        const p = readPixel();
        for (let i = 0; i < count; i++) put(p);
      } else for (let i = 0; i < count; i++) put(readPixel());
    }
  return { width, height, pixels };
}
