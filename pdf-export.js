'use strict';
/* Build a complete raster PDF, then measure the serialized file including PDF overhead. */
async function exportCompressedPdf(batch, renderPage, limit, shouldCancel = () => false, onProgress = () => {}) {
  const abort = () => {if (shouldCancel()) throw new DOMException('已取消', 'AbortError');};
  if (!batch.length) throw new Error('请至少选择一个项目');
  let pageBudget = Math.floor((limit - 1024 - batch.length * 400) / batch.length);
  if (pageBudget < 512) throw new Error('所选页数过多，无法满足当前大小上限，请提高上限或减少页数');
  for (let attempt = 0; attempt < 5; attempt++) {
    abort(); const document = await PDFLib.PDFDocument.create(); let imageBytes = 0, cover;
    document.setProducer('Qing Cailiao'); document.setCreator('Qing Cailiao');
    for (let i = 0; i < batch.length; i++) {
      abort(); onProgress(i, batch.length, attempt); const item = batch[i]; let canvas;
      try {
        canvas = await renderPage(item);
        const encoded = await compressCanvas(canvas, 'jpg', pageBudget, shouldCancel); abort();
        if (!cover) cover = {blob:encoded.blob,width:encoded.width,height:encoded.height};
        const bytes = new Uint8Array(await encoded.blob.arrayBuffer()); imageBytes += bytes.length;
        const image = await document.embedJpg(bytes); abort();
        const physicalScale = Math.min(item.kind === 'pdf' ? 1 : .75, 14400 / Math.max(item.width, item.height));
        const width = item.width * physicalScale, height = item.height * physicalScale;
        document.addPage([width,height]).drawImage(image,{x:0,y:0,width,height});
      } finally {if (canvas) canvas.width = canvas.height = 1;}
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    abort(); const bytes = await document.save({useObjectStreams:true,addDefaultPage:false}); abort();
    if (bytes.length <= limit) return {blob:new Blob([bytes],{type:'application/pdf'}),pageCount:batch.length,cover};
    const overhead = bytes.length - imageBytes;
    pageBudget = Math.floor(pageBudget * Math.max(.1,(limit - overhead) / imageBytes) * .94);
    if (pageBudget < 512) break;
  }
  throw new Error('PDF 无法满足当前大小上限，请提高上限或减少选择的页面');
}
window.exportCompressedPdf = exportCompressedPdf;
