/** Build an RGBA image buffer in memory. No disk, no PNG encode needed. */
export function solid(width, height, [r, g, b]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** A grey field with a horizontal gradient, so it is not flat. */
export function gradient(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = Math.round(40 + (170 * x) / Math.max(1, width - 1));
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/**
 * Copy an image and paint a centred square covering `fraction` of the area.
 * Simulates "character present" vs "character hidden".
 */
export function withBlob(img, fraction, [r, g, b] = [255, 0, 0]) {
  const out = { width: img.width, height: img.height, data: Uint8Array.from(img.data) };
  const side = Math.round(Math.sqrt(fraction * img.width * img.height));
  const x0 = Math.floor((img.width - side) / 2);
  const y0 = Math.floor((img.height - side) / 2);
  for (let y = y0; y < y0 + side; y++) {
    for (let x = x0; x < x0 + side; x++) {
      const i = (y * out.width + x) * 4;
      out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
    }
  }
  return out;
}
