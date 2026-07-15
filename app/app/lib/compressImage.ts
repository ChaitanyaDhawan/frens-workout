// Client-side image compression before upload — keeps proof photos crisp while
// keeping each one small so the free 1 GB storage tier lasts years.
// Downscales to a max long edge and re-encodes as WebP (≈30% smaller than JPEG
// at equal quality), falling back to JPEG where WebP encoding isn't supported.

const MAX_EDGE = 1600;
// 0.92 keeps proof photos visually indistinguishable from the original (0.85 was
// dimming/softening them noticeably in the feed) while staying well within the
// storage tier — a 1600px WebP at 0.92 is still only ~150–300 KB.
const QUALITY = 0.92;

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, type, quality));
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    // from-image respects EXIF orientation so portrait phone shots aren't rotated.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    // Prefer WebP; a browser that can't encode it returns some other type (e.g.
    // PNG) — detect that and fall back to JPEG.
    let blob = await encode(canvas, "image/webp", QUALITY);
    let type = "image/webp";
    let ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await encode(canvas, "image/jpeg", QUALITY);
      type = "image/jpeg";
      ext = "jpg";
    }
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
    return new File([blob], name, { type });
  } catch {
    return file; // fall back to the original on any decode failure
  }
}
