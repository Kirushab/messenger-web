// Сжимает фото до разумного размера для мессенджера.
// - max 2048px по большей стороне (хватает для скриншотов с мелким текстом)
// - JPEG quality 0.85 (визуально неотличимо для большинства фото, размер -70%)
// - Конвертирует в JPEG (HEIC/PNG/WebP → .jpg) для единообразия
//
// Skip:
// - Файл уже меньше 400 КБ (нет смысла перекодировать)
// - GIF (canvas-перекодировка убивает анимацию)
// - SVG (вектор)
// - Не image/*
export async function compressImage(file: File, maxDim = 2048, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;
  if (file.type === 'image/svg+xml') return file;
  if (file.size < 400 * 1024) return file;
  try {
    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
    URL.revokeObjectURL(url);
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const r = Math.min(maxDim / width, maxDim / height);
      width *= r; height *= r;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);
    const blob: Blob = await new Promise(r => canvas.toBlob(b => r(b!), 'image/jpeg', quality));
    // Если итог больше оригинала (бывает на маленьких) — оставляем оригинал
    if (blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  } catch { return file; }
}
