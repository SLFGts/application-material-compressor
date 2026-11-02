/* Output limits are bytes. PNG compression uses resizing; JPEG also adjusts quality. */
async function compressCanvas(source, format, limit = 200000, shouldCancel = () => false) {
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const canvas = document.createElement('canvas');
  const abort = () => {if (shouldCancel()) throw new DOMException('已取消', 'AbortError');};
  const encode = quality => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('浏览器无法编码图片')), mime, quality));
  let width = source.width, height = source.height;
  try {
    for (let step = 0; step < 64; step++) {
      abort(); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); if (!context) throw new Error('无法创建压缩画布，请减少选择的材料');
      context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); context.drawImage(source, 0, 0, width, height);
      let blob = await encode(.94); abort();
      if (blob.type !== mime) throw new Error('当前浏览器不支持所选图片格式');
      if (blob.size <= limit) return {blob, width, height};
      if (format === 'jpg' || format === 'jpeg') {
        const minimum = await encode(.55); abort();
        if (minimum.size <= limit) {
          let low = .55, high = .94, best = minimum;
          for (let i = 0; i < 7; i++) {
            abort(); const mid = (low + high) / 2, candidate = await encode(mid); abort();
            if (candidate.size <= limit) {best = candidate; low = mid;} else high = mid;
          }
          return {blob:best, width, height};
        }
        blob = minimum;
      }
      if (width === 1 && height === 1) break;
      const ratio = Math.max(.5,Math.min(.88,Math.sqrt(limit / blob.size) * .94));
      width = Math.max(1,Math.floor(width * ratio)); height = Math.max(1,Math.round(width * source.height / source.width));
    }
    throw new Error('无法将图片压缩到 ' + Math.round(limit / 1000) + 'KB 以内，请提高上限或减少内容');
  } finally {canvas.width = canvas.height = 1;}
}
window.compressCanvas = compressCanvas;
