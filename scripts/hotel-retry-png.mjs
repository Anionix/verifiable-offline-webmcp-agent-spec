import { crc32, inflateSync } from "node:zlib";

// information_uuid_v5=17898066-d1e0-50f3-96c7-e30c23316f5a
// event_uuid_v7=01a05528-86e9-7dc9-b6f8-50cd1306e91e state_transition=PNG_RELEASE_BYTES_UNCHECKED -> PNG_STRUCTURE_AND_SCANLINES_VALIDATED occurred_at=2026-08-31T00:11:54.473Z
// machine-contract: validate the packaged hotel retry PNG from one caller-owned byte buffer; do not read files or use the network, and bound zlib output to expectedScanlineBytes + 1.
// Scope: the fixed non-interlaced 1672x941 8-bit RGB diagram; ancillary color-profile semantics are not attested.
// Sources: https://www.w3.org/TR/png/ and https://nodejs.org/download/release/v24.15.0/docs/api/zlib.html

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const expectedWidth = 1_672;
const expectedHeight = 941;
const expectedBitDepth = 8;
const expectedColorType = 2;
const expectedBytesPerPixel = 3;
const maximumPngFourByteInteger = 0x7fffffff;
const knownCriticalChunks = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);

function rejectPng(reason) {
  throw new Error(`hotel retry diagram PNG ${reason}`);
}

function requirePng(condition, reason) {
  if (!condition) rejectPng(reason);
}

function isUppercaseAscii(byte) {
  return byte >= 65 && byte <= 90;
}

export function validateHotelRetryPng(bytes) {
  requirePng(bytes instanceof Uint8Array, "must be a byte buffer");
  const png = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  requirePng(png.length >= pngSignature.length, "is truncated before its signature");
  requirePng(png.subarray(0, pngSignature.length).equals(pngSignature), "has an invalid PNG signature");

  let offset = pngSignature.length;
  let seenIhdr = false;
  let seenPlte = false;
  let seenIdat = false;
  let idatClosed = false;
  let seenIend = false;
  let ihdr;
  const idatChunks = [];

  while (offset < png.length) {
    requirePng(png.length - offset >= 12, "has a truncated chunk header");
    const length = png.readUInt32BE(offset);
    requirePng(length <= maximumPngFourByteInteger, "has an oversized chunk length");
    const typeOffset = offset + 4;
    const typeBytes = png.subarray(typeOffset, typeOffset + 4);
    requirePng(
      typeBytes.every((byte) => isUppercaseAscii(byte) || (byte >= 97 && byte <= 122)),
      "has an invalid chunk type",
    );
    requirePng(isUppercaseAscii(typeBytes[2]), "has a reserved chunk type bit");
    const type = typeBytes.toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    requirePng(Number.isSafeInteger(chunkEnd) && chunkEnd <= png.length, `has a truncated ${type} chunk`);

    const expectedCrc = png.readUInt32BE(dataEnd);
    const actualCrc = crc32(png.subarray(typeOffset, dataEnd)) >>> 0;
    requirePng(actualCrc === expectedCrc, `${type} chunk CRC mismatch`);
    requirePng(!seenIend, "has data after IEND");
    if (type !== "IHDR" && type !== "IDAT" && type !== "IEND" && isUppercaseAscii(typeBytes[0]) && !knownCriticalChunks.has(type))
      rejectPng(`contains an unknown critical chunk ${type}`);

    if (type === "IHDR") {
      requirePng(!seenIhdr && offset === pngSignature.length, "has IHDR more than once or not as its first chunk");
      requirePng(length === 13, "has an invalid IHDR length");
      seenIhdr = true;
      ihdr = {
        width: png.readUInt32BE(dataStart),
        height: png.readUInt32BE(dataStart + 4),
        bitDepth: png[dataStart + 8],
        colorType: png[dataStart + 9],
        compressionMethod: png[dataStart + 10],
        filterMethod: png[dataStart + 11],
        interlaceMethod: png[dataStart + 12],
      };
      requirePng(ihdr.width === expectedWidth && ihdr.height === expectedHeight, `has unexpected dimensions ${ihdr.width}x${ihdr.height}`);
      requirePng(ihdr.bitDepth === expectedBitDepth && ihdr.colorType === expectedColorType, "has unsupported bit depth or color type");
      requirePng(
        ihdr.compressionMethod === 0 && ihdr.filterMethod === 0 && ihdr.interlaceMethod === 0,
        "has unsupported compression, filter, or interlace method",
      );
    } else {
      requirePng(seenIhdr, "does not start with IHDR");
    }

    if (type === "PLTE") {
      requirePng(!seenPlte && !seenIdat, "has duplicate or out-of-order PLTE");
      requirePng(length >= 3 && length <= 768 && length % 3 === 0, "has an invalid PLTE length");
      seenPlte = true;
    }

    if (type === "IDAT") {
      requirePng(!idatClosed, "has non-consecutive IDAT chunks");
      seenIdat = true;
      idatChunks.push(png.subarray(dataStart, dataEnd));
    } else {
      if (seenIdat) idatClosed = true;
      if (type === "IEND") {
        requirePng(length === 0, "has a non-empty IEND chunk");
        requirePng(seenIdat, "has IEND before IDAT");
        seenIend = true;
        requirePng(chunkEnd === png.length, "has trailing bytes after IEND");
      }
    }
    offset = chunkEnd;
  }

  requirePng(seenIhdr, "is missing IHDR");
  requirePng(seenIdat, "is missing IDAT");
  requirePng(seenIend, "is missing IEND");

  const expectedScanlineBytes = expectedHeight * (1 + expectedWidth * expectedBytesPerPixel);
  const compressedBytes = Buffer.concat(idatChunks);
  let scanlines;
  try {
    const inflated = inflateSync(compressedBytes, { maxOutputLength: expectedScanlineBytes + 1, info: true });
    requirePng(inflated.engine.bytesWritten === compressedBytes.length, "has trailing compressed image data");
    scanlines = inflated.buffer;
  } catch (error) {
    throw new Error("hotel retry diagram PNG has invalid compressed image data", { cause: error });
  }
  requirePng(scanlines.length === expectedScanlineBytes, `has ${scanlines.length} decoded bytes; expected ${expectedScanlineBytes}`);

  const scanlineStride = 1 + expectedWidth * expectedBytesPerPixel;
  for (let row = 0; row < expectedHeight; row += 1) {
    const filterType = scanlines[row * scanlineStride];
    requirePng(filterType <= 4, `has invalid scanline filter type ${filterType} at row ${row}`);
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    bitDepth: ihdr.bitDepth,
    colorType: ihdr.colorType,
  };
}
