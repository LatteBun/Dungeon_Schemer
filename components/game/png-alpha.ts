import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

/**
 * PNG 의 알파 여백 측정.
 *
 * 화면마다 같은 디코더를 복사하면 한쪽만 고쳐진다. 실제로 U3 쪽 헬퍼는 세로
 * 여백만 재고 있어서 좌우 치우침을 놓쳤고, 팔레트 PNG 만 읽어 RGBA 자산을
 * 다루지 못했다. 고칠 곳을 하나로 둔다.
 *
 * 8비트 비인터레이스 PNG 의 팔레트(색 타입 3)와 RGBA(6) 를 다룬다.
 */

export function pngDimensions(path: string): { width: number; height: number } {
  const content = readFileSync(path);
  return {
    width: content.readUInt32BE(16),
    height: content.readUInt32BE(20),
  };
}

export function pngAlphaPadding(path: string): { top: number; bottom: number; left: number; right: number } {
  const content = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 3;
  let transparency = Buffer.alloc(0);
  const compressedRows: Buffer[] = [];

  while (offset < content.length) {
    const length = content.readUInt32BE(offset);
    const type = content.toString("ascii", offset + 4, offset + 8);
    const data = content.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      compressedRows.push(data);
    }
  }

  // 팔레트(3)는 tRNS 로, RGBA(6)는 네 번째 바이트로 알파를 읽는다.
  const bytesPerPixel = colorType === 6 ? 4 : 1;
  const stride = width * bytesPerPixel;
  const filtered = inflateSync(Buffer.concat(compressedRows));
  const rows: Buffer[] = [];
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[y * (stride + 1)];
    const source = filtered.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      if (filter === 2) predictor = up;
      if (filter === 3) predictor = Math.floor((left + up) / 2);
      if (filter === 4) {
        const value = left + up - upLeft;
        const leftDistance = Math.abs(value - left);
        const upDistance = Math.abs(value - up);
        const upLeftDistance = Math.abs(value - upLeft);
        predictor = leftDistance <= upDistance && leftDistance <= upLeftDistance
          ? left
          : upDistance <= upLeftDistance ? up : upLeft;
      }
      row[x] = (source[x] + predictor) & 0xff;
    }
    rows.push(row);
    previous = row;
  }

  const alphaAt = (row: Buffer, x: number) => colorType === 6
    ? row[x * 4 + 3]
    : (transparency[row[x]] ?? 255);
  const opaqueRows = rows.map((row) => {
    for (let x = 0; x < width; x += 1) if (alphaAt(row, x) > 0) return true;
    return false;
  });
  const opaqueColumns = Array.from({ length: width }, (_, x) => rows.some((row) => alphaAt(row, x) > 0));

  return {
    top: opaqueRows.indexOf(true),
    bottom: height - 1 - opaqueRows.lastIndexOf(true),
    left: opaqueColumns.indexOf(true),
    right: width - 1 - opaqueColumns.lastIndexOf(true),
  };
}
