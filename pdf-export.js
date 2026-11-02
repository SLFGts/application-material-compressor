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
        const dims=window.PageEdit?PageEdit.dimensions(item):item;
        const physicalScale = Math.min(item.kind === 'pdf' ? 1 : .75, 14400 / Math.max(dims.width, dims.height));
        const width = dims.width * physicalScale, height = dims.height * physicalScale;
        document.addPage([width,height]).drawImage(image,{x:0,y:0,width,height});
      } finally {if (canvas) canvas.width = canvas.height = 1;}
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    abort(); const bytes = await document.save({useObjectStreams:true,addDefaultPage:false}); abort();
    if (bytes.length <= limit) return {blob:new Blob([bytes],{type:'application/pdf'}),pageCount:batch.length,cover,pdfMode:'raster'};
    const overhead = bytes.length - imageBytes;
    pageBudget = Math.floor(pageBudget * Math.max(.1,(limit - overhead) / imageBytes) * .94);
    if (pageBudget < 512) break;
  }
  throw new Error('PDF 无法满足当前大小上限，请提高上限或减少选择的页面');
}
window.exportCompressedPdf = exportCompressedPdf;

/* Keep native PDF page content when the complete file fits the chosen limit. */
async function exportPdfWithEdits(batch,renderPage,limit,sourceFor,shouldCancel=()=>false,onProgress=()=>{}) {
  const abort=()=>{if (shouldCancel()) throw new DOMException('已取消','AbortError');};
  try {
    abort();const output=await PDFLib.PDFDocument.create(),sourceDocs=new Map(),embedded=new Map();
    for (let i=0;i<batch.length;i++) {
      abort();const item=batch[i];onProgress(i,batch.length,0);
      if (item.kind==='pdf') {
        const source=sourceFor(item);
        if (!sourceDocs.has(item.sourceId)) sourceDocs.set(item.sourceId,await PDFLib.PDFDocument.load(await source.file.arrayBuffer(),{updateMetadata:false}));
        abort();const [page]=await output.copyPages(sourceDocs.get(item.sourceId),[item.page-1]);output.addPage(page);
        const pdfPage=await source.pdf.getPage(item.page),viewport=pdfPage.getViewport({scale:1});
        if (item.edits?.crop) {const box=PageEdit.pdfGeometry(viewport,PageEdit.crop(item));page.setCropBox(box.x,box.y,box.width,box.height);}
        for (const overlay of item.edits?.overlays||[]) {
          abort();let image=embedded.get(overlay.blob);
          if (!image) {const data=await overlay.blob.arrayBuffer();image=overlay.blob.type==='image/png'?await output.embedPng(data):await output.embedJpg(data);embedded.set(overlay.blob,image);}
          const g=PageEdit.pdfGeometry(viewport,overlay);
          page.drawImage(image,{x:g.imageX,y:g.imageY,width:g.imageWidth,height:g.imageHeight,rotate:PDFLib.degrees(g.angle)});
        }
      } else {
        let canvas;
        try {
          canvas=await renderPage(item);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if (!blob) throw new Error('图片编码失败');
          const image=await output.embedJpg(await blob.arrayBuffer()),d=PageEdit.dimensions(item),scale=Math.min(.75,14400/Math.max(d.width,d.height));
          const w=d.width*scale,h=d.height*scale;output.addPage([w,h]).drawImage(image,{x:0,y:0,width:w,height:h});
        } finally {if (canvas) canvas.width=canvas.height=1;}
      }
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    abort();const bytes=await output.save({useObjectStreams:true,addDefaultPage:false});abort();
    if (bytes.length<=limit) {
      let canvas;try {
        canvas=await renderPage(batch[0]);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));if (!blob) throw new Error('无法生成 PDF 预览');abort();
        return {blob:new Blob([bytes],{type:'application/pdf'}),pageCount:batch.length,cover:{blob,width:canvas.width,height:canvas.height},pdfMode:'native'};
      } finally {if (canvas) canvas.width=canvas.height=1;}
    }
  } catch(error) {if (error.name==='AbortError') throw error;}
  abort();return exportCompressedPdf(batch,renderPage,limit,shouldCancel,onProgress);
}
window.exportPdfWithEdits=exportPdfWithEdits;
