/** Browser-side photo prep. Phone camera shots run 5–15 MB — over Vercel's
 * 4.5 MB request limit — so we downscale before upload. Canvas re-encoding
 * also bakes EXIF rotation into the pixels and strips all metadata (GPS
 * included) before the photo ever leaves the phone. Falls back to the
 * original file on any decode failure (e.g. exotic formats). */
export async function compressImage(
  file: File,
  maxDim = 2000,
  quality = 0.85,
): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob || blob.size === 0) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
