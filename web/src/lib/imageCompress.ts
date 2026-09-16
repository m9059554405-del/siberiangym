// Клиентское сжатие фото перед отправкой (P0.5) — реальное фото с камеры
// телефона обычно 3–10 МБ; без этого шага загрузка либо не проходит
// лимиты (nginx/API), либо раздувает трафик и место в хранилище зря.
// Ограничиваем длинную сторону и итеративно снижаем качество JPEG, пока
// результат не уложится в целевой размер (или пока не кончатся попытки —
// тогда отправляем лучшее, что получилось, а не зависаем).
const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_TARGET_BYTES = 500 * 1024;
const MAX_QUALITY_STEPS = 4;

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Не удалось сжать изображение'))), 'image/jpeg', quality);
  });
}

export async function compressImage(
  file: File,
  opts: { maxDimension?: number; targetBytes?: number } = {},
): Promise<Blob> {
  const maxDimension = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const targetBytes = opts.targetBytes ?? DEFAULT_TARGET_BYTES;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен в этом браузере');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.85;
  let blob = await toBlob(canvas, quality);
  for (let i = 0; i < MAX_QUALITY_STEPS && blob.size > targetBytes && quality > 0.35; i++) {
    quality -= 0.15;
    blob = await toBlob(canvas, quality);
  }
  return blob;
}
