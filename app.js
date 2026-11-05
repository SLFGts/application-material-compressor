'use strict';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
const $ = id => document.getElementById(id);
let limitBytes = 200000, resultSignature = '';
function settingsSignature() {return JSON.stringify([format,mode,limitBytes,selectedItems().map(i=>[i.id,i.edits?.crop,(i.edits?.overlays||[]).map(o=>[o.id,o.x,o.y,o.w,o.h])])]);}
function icon(name) {
  const paths={up:'M12 19V5m-5 5 5-5 5 5',down:'M12 5v14m-5-5 5 5 5-5',close:'m6 6 12 12M6 18 18 6',download:'M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4',arrow:'M5 12h14m-5-5 5 5-5 5',check:'m5 12 4 4L19 6'};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]);svg.append(path);return svg;
}
let sources = [], items = [], results = [], format = 'jpg', mode = 'merge';
let busy = false, cancelled = false, idCounter = 0, thumbnailChain = Promise.resolve();
let previewUrl = null, thumbnailObserver;
let previewPdf = null, previewTask = null, previewSerial = 0, pageRenderSerial = 0, currentPdfPage = 1;
const nextId = prefix => prefix + (++idCounter);
const size = bytes => bytes < 1000000 ? (bytes / 1000).toFixed(1) + ' KB' : (bytes / 1000000).toFixed(1) + ' MB';
const message = value => {$('message').textContent = value;};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function abortIfCancelled() {if (cancelled) throw new DOMException('已取消', 'AbortError');}
function selectedItems() {return items.filter(item => item.selected);}
function sourceOf(item) {return sources.find(source => source.id === item.sourceId);}
function itemLabel(item) {return item.fileName + (item.page ? ' · 第 ' + item.page + ' 页' : '');}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function setBusy(value) {
  busy = value;
  if (!value && $('progress').value === 100) $('progress-area').hidden = true;
  $('files').disabled = value; $('drop').setAttribute('aria-disabled', String(value));
  $('clear').disabled = value; $('download-all').disabled = value || !results.length;
  document.querySelectorAll('.batch-control, [data-file-check], [data-item-check], [data-remove], [data-move], .item-thumb, .item-edit-button').forEach(control => {
    control.disabled = value || control.dataset.boundary === 'true';
  });
  refreshSelection();
}
function refreshSelection() {
  const count = selectedItems().length;
  $('selection-count').textContent = items.length ? '已选 ' + count + ' / ' + items.length + ' 项' : '';
  $('selection-count').classList.toggle('empty-selection', items.length > 0 && count === 0);
  document.body.classList.toggle('has-materials',items.length>0);
  $('material-total').textContent=sources.length ? sources.length+' 份文件' : '';
  $('item-total').textContent=items.length+' 项';
  $('drop-title').textContent=items.length ? '添加文件' : '拖入文件，或点击添加';
  if (results.length) {const stale=resultSignature!==settingsSignature();$('result-note').classList.toggle('stale',stale);$('result-note').textContent=stale ? '材料或设置已更改，请重新生成。' : '下载前请放大检查清晰度。'+(results.length>1?' ZIP 需解压后使用其中的文件。':'');}
  const isPdf = format === 'pdf', bound = size(limitBytes);
  $('convert').disabled = busy || count === 0 || !$('size-value').checkValidity();
  $('convert').replaceChildren(document.createTextNode(mode === 'merge' ? (isPdf ? '生成 PDF ' : '生成长图 ') : '生成文件 '), icon('arrow'));
  $('merge-title').textContent = isPdf ? '合并为一个 PDF' : '合并为一张长图';
  $('merge-description').textContent = isPdf ? '每项一页' : '按顺序纵向拼接';
  $('limit-label').textContent = isPdf ? (mode === 'merge' ? '整个 PDF 大小上限' : '每个 PDF 大小上限') : (mode === 'merge' ? '整张长图大小上限' : '每张图片大小上限');
  $('format-note').textContent = isPdf ? '优先保留原 PDF 文字；超过上限时转为图片化压缩' : (format === 'png' ? 'PNG 通过调整尺寸控制大小' : 'JPG / JPEG 编码相同，扩展名不同');
  $('output-summary').textContent = count ? count + ' 项 → ' + (mode === 'merge' ? (isPdf ? '1 个 PDF' : '1 张长图') : count + ' 个文件') : '请先添加文件';
  $('format-hint').textContent = (mode === 'merge' ? (isPdf ? '整个 PDF' : '整张长图') : '每个输出文件') + '不超过 ' + limitBytes.toLocaleString('zh-CN') + ' 字节。实际文件可能更小；上限越低、内容越多，清晰度可能越低，请放大检查。';
  for (const source of sources) {
    const members = items.filter(item => item.sourceId === source.id), checked = members.filter(item => item.selected).length;
    const input = document.querySelector('[data-file-check="' + source.id + '"]');
    if (input) {input.checked = checked === members.length; input.indeterminate = checked > 0 && checked < members.length;}
    const info = document.querySelector('[data-file-count="' + source.id + '"]');
    if (info) info.textContent = '已选 ' + checked + '/' + members.length + ' · ' + size(source.file.size);
  }
  for (const item of items) {
    const card = document.getElementById(item.id), input = card?.querySelector('input');
    if (card) {card.classList.toggle('chosen', item.selected); card.classList.toggle('excluded', !item.selected);}
    if (input) input.checked = item.selected;
  }
}
function setLimit(kb, updateInput = true) {
  limitBytes = Math.round(Math.max(50, Math.min(10000, kb))) * 1000;
  if (updateInput) $('size-value').value = limitBytes / 1000;
  $('size-slider').value = Math.round(Math.log(limitBytes / 50000) / Math.log(200) * 1000);
  $('size-slider').setAttribute('aria-valuetext', size(limitBytes));
  refreshSelection();
}
$('size-slider').oninput = e => {if (!busy) setLimit(Math.round(50 * Math.pow(200, Number(e.target.value) / 1000) / 10) * 10);};
$('size-value').oninput = e => {
  if (busy) return;
  if (e.target.checkValidity() && e.target.value !== '') setLimit(e.target.valueAsNumber, false);
  else $('convert').disabled = true;
};
$('size-value').onchange = e => {if (!busy) setLimit(e.target.value !== '' && Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : limitBytes / 1000);};
$('reset-size').onclick = () => {if (!busy) setLimit(200);};
function showProgress(text, value = 0) {
  $('progress-area').hidden = false; $('progress-text').textContent = text; $('progress').value = value;
}
function resetCancellation() {cancelled = false; $('cancel').disabled = false;}
function makeFileQueue() {
  $('queue').replaceChildren();
  for (const source of sources) {
    const row = element('div', 'file-row'), label = element('label', 'source-select'), check = document.createElement('input');
    check.type = 'checkbox'; check.dataset.fileCheck = source.id; check.disabled = busy;
    check.setAttribute('aria-label', '选择文件 ' + source.file.name);
    check.onchange = () => {items.filter(item => item.sourceId === source.id).forEach(item => item.selected = check.checked); refreshSelection();};
    const name = element('span', 'name', source.file.name); name.title = source.file.name;
    label.append(check, name);
    const info = element('small'); info.dataset.fileCount = source.id;
    const remove = element('button', 'text-button'); remove.append(icon('close')); remove.dataset.remove = source.id; remove.disabled = busy;
    remove.setAttribute('aria-label', '移除 ' + source.file.name);
    remove.onclick = async () => {
      if (busy) return;
      items.filter(item => item.sourceId === source.id).forEach(item => {if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl); for (const overlay of item.edits?.overlays || []) URL.revokeObjectURL(overlay.url);});
      items = items.filter(item => item.sourceId !== source.id); sources = sources.filter(s => s !== source);
      if (source.url) URL.revokeObjectURL(source.url);
      if (source.pdf) await source.pdf.destroy().catch(() => {});
      renderSelection();
    };
    row.append(label, info, remove); $('queue').append(row);
  }
}
function moveItem(item, delta) {
  if (busy) return;
  const index = items.indexOf(item), to = index + delta;
  if (to < 0 || to >= items.length) return;
  [items[index], items[to]] = [items[to], items[index]];
  const scrollTop = $('items').scrollTop;
  renderSelection(); $('items').scrollTop = scrollTop;
  document.getElementById(item.id)?.querySelector('[data-move="' + delta + '"]')?.focus();
}
function renderSelection() {
  thumbnailObserver?.disconnect(); makeFileQueue(); $('items').replaceChildren(); $('selection').hidden = !items.length;
  items.forEach((item, index) => {
    const card = element('article', 'item-card'); card.id = item.id;
    const top = element('div', 'item-top'), label = element('label'), check = document.createElement('input');
    check.type = 'checkbox'; check.dataset.itemCheck = item.id; check.disabled = busy;
    check.setAttribute('aria-label', '选择 ' + itemLabel(item));
    check.onchange = () => {item.selected = check.checked; refreshSelection();};
    label.append(check, element('span', 'item-order', String(index + 1).padStart(2, '0')));
    top.append(label, element('span', '', item.kind === 'pdf' ? 'PDF' : item.kind.toUpperCase()));
    const thumb = element('button', 'item-thumb'); thumb.dataset.itemId = item.id; thumb.disabled = busy;
    thumb.setAttribute('aria-label', '预览材料 ' + itemLabel(item));
    if (item.thumbUrl) {const image = new Image(); image.src = item.thumbUrl; image.alt = itemLabel(item); thumb.append(image);}
    else thumb.append(element('span', 'item-placeholder', '预览加载中…'));
    thumb.onclick = () => previewItem(item);
    const title = element('p', 'item-label', item.fileName); title.title = item.fileName;
    const bottom = element('div', 'item-bottom'), controls = element('div');
    bottom.append(element('small', '', item.page ? '第 ' + item.page + ' 页' : item.width + ' × ' + item.height));
    for (const delta of [-1, 1]) {
      const button = element('button');button.append(icon(delta===-1?'up':'down')); button.dataset.move = delta;
      button.dataset.boundary = String(delta === -1 ? index === 0 : index === items.length - 1);
      button.disabled = busy || button.dataset.boundary === 'true';
      button.setAttribute('aria-label', (delta === -1 ? '前移 ' : '后移 ') + itemLabel(item)); button.onclick = () => moveItem(item, delta); controls.append(button);
    }
    bottom.append(controls); card.append(top, thumb, title, bottom);
    if (item.kind === 'pdf') {
      const editRow=element('div','item-edit-row'),editButton=element('button','item-edit-button','裁剪 / 贴图');
      editButton.disabled=busy;editButton.setAttribute('aria-label','编辑 '+itemLabel(item));editButton.onclick=()=>{if (!busy) PageEdit.open(item);};
      editRow.append(editButton,element('span','edited-tag',PageEdit.changed(item)?'已编辑':''));card.append(editRow);
    }
    $('items').append(card);
  });
  refreshSelection(); observeThumbnails();
}
function observeThumbnails() {
  thumbnailObserver?.disconnect();
  thumbnailObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const item = items.find(i => i.id === entry.target.dataset.itemId);
      if (!item || item.thumbUrl || item.thumbPending || busy) continue;
      item.thumbPending = true;
      thumbnailChain = thumbnailChain.then(async () => {
        if (busy || !items.includes(item)) return;
        let canvas;
        try {
          canvas = await renderItem(item, Math.min(240, item.width), 800);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .78));
          if (!blob || !items.includes(item)) return;
          item.thumbUrl = URL.createObjectURL(blob);
          const target = document.getElementById(item.id)?.querySelector('.item-thumb');
          if (target) {const image = new Image(); image.src = item.thumbUrl; image.alt = itemLabel(item); target.replaceChildren(image);}
        } catch {
          const target = document.getElementById(item.id)?.querySelector('.item-placeholder');
          if (target) target.textContent = '点击查看材料';
        } finally {if (canvas) canvas.width = canvas.height = 1;}
      }).finally(() => {item.thumbPending = false;});
    }
  }, {root: $('items'), rootMargin:'100px'});
  document.querySelectorAll('.item-thumb').forEach(button => thumbnailObserver.observe(button));
}
function readImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('图片无法读取')); image.src = url;
  });
}
async function renderOriginalItem(item, targetWidth, maxHeight = 16000) {
  const source = sourceOf(item);
  if (!source) throw new Error('材料已移除');
  const scale = Math.min(targetWidth / item.width, maxHeight / item.height, Math.sqrt(12000000 / (item.width * item.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(item.width * scale)); canvas.height = Math.max(1, Math.round(item.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建图片画布');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  try {
    if (item.kind === 'pdf') {
      const page = await source.pdf.getPage(item.page);
      await page.render({canvasContext:context, viewport:page.getViewport({scale}), background:'#fff'}).promise;
    } else {
      const image = await readImage(source.url); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  } catch (error) {canvas.width = canvas.height = 1; throw error;}
}
async function renderItem(item,targetWidth,maxHeight=16000) {return PageEdit.render(item,renderOriginalItem,targetWidth,maxHeight);}
function invalidateThumbnail(item) {if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);item.thumbUrl=null;}
PageEdit.init({
  onBusy:value=>{setBusy(value);if (!value) observeThumbnails();},renderOriginal:renderOriginalItem,waitThumbnails:()=>thumbnailChain,
  onCommit:(item,edits,applyAll)=>{
    const retained=new Set(edits.overlays.map(o=>o.url));
    for (const overlay of item.edits?.overlays || []) if (!retained.has(overlay.url)) URL.revokeObjectURL(overlay.url);
    item.edits={crop:{...edits.crop},overlays:edits.overlays.map(o=>({...o}))};invalidateThumbnail(item);
    if (applyAll) for (const other of items.filter(i=>i.sourceId===item.sourceId&&i!==item)) {
      other.edits={crop:{...edits.crop},overlays:other.edits?.overlays||[]};invalidateThumbnail(other);
    }
    renderSelection();showProgress('页面编辑已保存，请重新生成所需输出。',100);message('');
  }
});
async function addFiles(fileList) {
  if (busy) return;
  const files = Array.from(fileList); if (!files.length) return;
  setBusy(true); resetCancellation(); message('');
  const errors = [];
  try {
    for (let index = 0; index < files.length; index++) {
      abortIfCancelled(); const file = files[index], kind = file.name.split('.').pop().toLowerCase();
      if (!['pdf','png','jpg','jpeg'].includes(kind)) {errors.push(file.name + '：仅支持 PDF、PNG、JPG 和 JPEG'); continue;}
      if (file.size > 50 * 1024 * 1024) {errors.push(file.name + '：超过单份 50MB 限制'); continue;}
      if (sources.some(s => s.file.name === file.name && s.file.size === file.size && s.file.lastModified === file.lastModified)) continue;
      showProgress('正在读取 ' + file.name, index / files.length * 100);
      const source = {id:nextId('source-'), file, kind}; let task;
      try {
        const members = [];
        if (kind === 'pdf') {
          task = pdfjsLib.getDocument({data:await file.arrayBuffer(), isEvalSupported:false});
          task.onPassword = () => {source.passwordProtected = true; task.destroy();};
          source.pdf = await task.promise;
          for (let p = 1; p <= source.pdf.numPages; p++) {
            abortIfCancelled(); const page = await source.pdf.getPage(p), view = page.getViewport({scale:1});
            members.push({id:nextId('item-'), sourceId:source.id, fileName:file.name, kind, page:p, width:view.width, height:view.height, selected:true});
            if (p % 10 === 0) {showProgress('正在读取 ' + file.name + ' · 第 ' + p + ' / ' + source.pdf.numPages + ' 页', (index + p / source.pdf.numPages) / files.length * 100); await tick();}
          }
        } else {
          source.url = URL.createObjectURL(file); const image = await readImage(source.url);
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('无效图片');
          members.push({id:nextId('item-'),sourceId:source.id,fileName:file.name,kind,width:image.naturalWidth,height:image.naturalHeight,selected:true});
        }
        abortIfCancelled(); sources.push(source); items.push(...members); renderSelection();
      } catch (error) {
        if (source.url) URL.revokeObjectURL(source.url);
        if (source.pdf) await source.pdf.destroy().catch(() => {}); else if (task) await task.destroy().catch(() => {});
        if (error.name === 'AbortError') throw error;
        errors.push(file.name + '：' + (source.passwordProtected ? '加密 PDF 暂不支持，请先解除密码保护' : '读取失败，请确认文件格式正确且可正常打开'));
      }
      await tick();
    }
    showProgress('添加完成 · 共 ' + sources.length + ' 份文件、' + items.length + ' 个可选项', 100);
  } catch (error) {
    if (error.name === 'AbortError') showProgress('已取消添加 · 已读入的材料仍可选择');
    else errors.push('添加材料失败，请重试。');
  } finally {setBusy(false); $('cancel').disabled = true; refreshSelection(); observeThumbnails(); message(errors.join('\n'));}
}
$('files').onchange = e => {addFiles(e.target.files); e.target.value = '';};
$('drop').onkeydown = e => {if ((e.key === 'Enter' || e.key === ' ') && !busy) {e.preventDefault(); $('files').click();}};
$('drop').ondragover = e => {e.preventDefault(); if (!busy) $('drop').classList.add('drag');};
$('drop').ondragleave = () => $('drop').classList.remove('drag');
$('drop').ondrop = e => {e.preventDefault(); $('drop').classList.remove('drag'); addFiles(e.dataTransfer.files);};
$('select-all').onclick = () => {if (!busy) {items.forEach(item => item.selected = true); refreshSelection();}};
$('select-none').onclick = () => {if (!busy) {items.forEach(item => item.selected = false); refreshSelection();}};
for (const button of document.querySelectorAll('[data-format]')) button.onclick = () => {
  if (busy) return; format = button.dataset.format;
  document.querySelectorAll('[data-format]').forEach(b => {b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button));}); refreshSelection();
};
for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => {
  if (busy) return; mode = button.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(b => {b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button));}); refreshSelection();
};
function openPreview(url, name) {
  disposePdfPreview(); $('pdf-preview-nav').hidden = true;
  $('preview-image').classList.remove('actual-size'); $('preview-zoom').textContent = '原尺寸查看';
  $('preview-image').src = url; $('preview-image').alt = name; $('preview-title').textContent = name; $('preview').showModal(); $('preview-scroll').scrollTop = 0;
}
async function previewItem(item) {
  if (busy) return;
  setBusy(true); resetCancellation(); showProgress('正在准备材料预览…'); let canvas;
  try {
    await thumbnailChain; abortIfCancelled();
    canvas = await renderItem(item, Math.min(item.width * (item.kind === 'pdf' ? 2.5 : 1), 1800), 5000);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); abortIfCancelled();
    if (!blob) throw new Error('预览失败');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob); openPreview(previewUrl, itemLabel(item)); showProgress('材料预览已就绪', 100);
  } catch (error) {if (error.name !== 'AbortError') message('无法预览此项材料，请尝试移除后重新添加。');}
  finally {if (canvas) canvas.width = canvas.height = 1; setBusy(false); $('cancel').disabled = true; observeThumbnails();}
}
$('preview-zoom').onclick = () => {const actual = $('preview-image').classList.toggle('actual-size'); $('preview-zoom').textContent = actual ? '适应窗口' : '原尺寸查看';};
$('close-preview').onclick = () => $('preview').close();
$('preview').onclick = e => {if (e.target === $('preview')) $('preview').close();};
$('preview').onclose = () => {disposePdfPreview(); if (previewUrl) {URL.revokeObjectURL(previewUrl); previewUrl = null;} $('preview-image').removeAttribute('src');};
function disposePdfPreview() {
  previewSerial++; pageRenderSerial++;
  const doc = previewPdf, task = previewTask; previewPdf = null; previewTask = null;
  if (doc) doc.destroy().catch(() => {}); else if (task) task.destroy().catch(() => {});
}
async function openPdfPreview(result) {
  disposePdfPreview(); const serial = previewSerial;
  $('preview-image').src = result.previewUrl; $('preview-image').alt = result.name;
  $('preview-image').classList.remove('actual-size'); $('preview-zoom').textContent = '原尺寸查看';
  $('preview-title').textContent = result.name; $('pdf-preview-nav').hidden = false;
  $('pdf-prev').disabled = $('pdf-next').disabled = true; $('pdf-page-count').textContent = '正在读取 PDF…';
  $('preview').showModal(); $('preview-scroll').scrollTop = 0;
  try {
    const bytes = await result.blob.arrayBuffer(); if (serial !== previewSerial) return;
    previewTask = pdfjsLib.getDocument({data:bytes,isEvalSupported:false});
    const doc = await previewTask.promise;
    if (serial !== previewSerial) {await doc.destroy(); return;}
    previewPdf = doc; await renderPdfPreviewPage(1);
  } catch {if (serial === previewSerial) $('pdf-page-count').textContent = '预览失败，请下载后查看';}
}
async function renderPdfPreviewPage(number) {
  const doc = previewPdf; if (!doc) return;
  const render = ++pageRenderSerial; let canvas;
  $('pdf-prev').disabled = $('pdf-next').disabled = true;
  try {
    const page = await doc.getPage(number), base = page.getViewport({scale:1});
    const view = page.getViewport({scale:Math.min(2,1400/base.width,5000/base.height,Math.sqrt(8000000/(base.width*base.height)))});
    canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(view.width)); canvas.height = Math.max(1,Math.round(view.height));
    await page.render({canvasContext:canvas.getContext('2d'),viewport:view,background:'#fff'}).promise;
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
    if (render !== pageRenderSerial || !blob) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(blob);
    $('preview-image').src = previewUrl; currentPdfPage = number;
    $('pdf-page-count').textContent = '第 ' + number + ' / ' + doc.numPages + ' 页';
    $('preview-scroll').scrollTop = 0;
  } catch {if (render === pageRenderSerial) $('pdf-page-count').textContent = '此页预览失败，请下载后查看';}
  finally {
    if (canvas) canvas.width = canvas.height = 1;
    if (render === pageRenderSerial) {$('pdf-prev').disabled = number <= 1; $('pdf-next').disabled = number >= doc.numPages;}
  }
}
$('pdf-prev').onclick = () => renderPdfPreviewPage(Math.max(1,currentPdfPage-1));
$('pdf-next').onclick = () => renderPdfPreviewPage(Math.min(previewPdf?.numPages || 1,currentPdfPage+1));
function clearResults() {
  if ($('preview').open) $('preview').close();
  results.forEach(result => {URL.revokeObjectURL(result.url); if (result.previewUrl !== result.url) URL.revokeObjectURL(result.previewUrl);});
  results = []; $('cards').replaceChildren(); $('results').hidden = true;
}
$('clear').onclick = clearResults;
function addResult(result) {
  if (result.blob.size > result.limitBytes) throw new Error('文件大小超出所选上限');
  result.url = URL.createObjectURL(result.blob);
  result.previewUrl = result.cover ? URL.createObjectURL(result.cover.blob) : result.url;
  results.push(result); resultSignature=settingsSignature(); $('results').hidden = false;
  const card = element('article', 'card'), thumb = element('button', 'thumb');
  thumb.setAttribute('aria-label', '预览结果 ' + result.name);
  const image = new Image(); image.src = result.previewUrl; image.alt = result.name + (result.pageCount ? '（首页）' : ''); image.loading = 'lazy'; thumb.append(image);
  if (result.pageCount) thumb.append(element('span','file-type','PDF · ' + result.pageCount + ' 页'));
  thumb.onclick = () => result.pageCount ? openPdfPreview(result) : openPreview(result.url, result.name);
  const body = element('div', 'card-body'), name = element('b', '', result.name); name.title = result.name;
  const meta = element('div', 'card-meta');
  meta.append(element('span', '', result.pageCount ? result.pageCount + ' 页 · PDF · ' + (result.pdfMode==='native'?'保留原页面':'图片化压缩') : result.width + ' × ' + result.height + ' px'), element('span','badge',size(result.blob.size)+' · 已达标'));
  const bottom = element('div', 'card-bottom');
  const warning = result.pageCount ? '点击预览，可逐页检查' : (Math.min(result.width,result.height) < 600 || result.parts > 4 ? '请放大检查文字清晰度' : '点击图片可放大检查');
  const link = element('a', '', result.pageCount ? '下载 PDF' : '下载文件'); link.append(icon('download')); link.href = result.url; link.download = result.name;
  bottom.append(element('span', '', warning), link); body.append(name, meta, element('p','result-limit','本次上限：' + size(result.limitBytes)));
  if (result.parts) body.append(element('p', 'card-origin', result.parts + ' 项材料 · ' + result.sourceNames.join(' → ')));
  body.append(bottom); card.append(thumb, body); $('cards').append(card);
}
function downloadBlob(url, name) {const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();}
function planLongImage(batch) {
  const ratio = batch.reduce((sum,item) => {const d=PageEdit.dimensions(item);return sum+d.height/d.width;}, 0);
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('材料尺寸无效');
  let width = Math.max(1, Math.floor(Math.min(1800, Math.max(...batch.map(item => PageEdit.dimensions(item).width * (item.kind === 'pdf' ? 2.5 : 1))), Math.sqrt(12000000 / ratio), 15000 / ratio)));
  let heights = batch.map(item => Math.max(1, Math.round(width * PageEdit.dimensions(item).height / PageEdit.dimensions(item).width)));
  let height = heights.reduce((sum, n) => sum + n, 0);
  while ((height > 16000 || width * height > 12000000) && width > 1) {
    width = Math.max(1, Math.floor(width * .9)); heights = batch.map(item => Math.max(1, Math.round(width * PageEdit.dimensions(item).height / PageEdit.dimensions(item).width))); height = heights.reduce((sum,n) => sum + n,0);
  }
  if (height > 16000) throw new Error('所选内容过长，请减少选择的项目后重试');
  return {width,height,heights};
}
$('cancel').onclick = () => {cancelled = true; $('cancel').disabled = true; $('progress-text').textContent = '正在取消，当前步骤结束后停止…';};
$('convert').onclick = async () => {
  const batch = selectedItems(); if (busy || !batch.length) return;
  if (!$('size-value').checkValidity()) return;
  const runMode = mode, runFormat = format, runLimit = limitBytes; setBusy(true); resetCancellation(); message(''); clearResults();
  $('cards').classList.toggle('single-result', runMode === 'merge');
  showProgress('正在准备所选材料…'); const errors = [];
  try {
    await thumbnailChain; abortIfCancelled();
    if (runFormat === 'pdf') {
      const batches = runMode === 'merge' ? [batch] : batch.map(item => [item]);
      const names = new Set();
      for (let group = 0; group < batches.length; group++) {
        abortIfCancelled(); const pages = batches[group];
        const output = await exportPdfWithEdits(pages, item => renderItem(item,Math.min(2400,PageEdit.dimensions(item).width*(item.kind==='pdf'?2.5:1)),5000), runLimit, sourceOf, () => cancelled, (i,total,attempt) => showProgress('正在生成 PDF · 文件 ' + (group+1) + '/' + batches.length + ' · 第 ' + (i+1) + '/' + total + ' 页' + (attempt ? '（调整压缩）' : ''), (group + i/total) / batches.length * 95));
        abortIfCancelled();
        const item = pages[0]; const stem = runMode === 'merge' ? '网申材料_合并_' + pages.length + '页' : item.fileName.replace(/\.(pdf|png|jpe?g)$/i,'') + (item.page ? '_第' + String(item.page).padStart(2,'0') + '页' : '');
        let name = stem + '.pdf', suffix = 2; while (names.has(name)) name = stem + '_' + suffix++ + '.pdf'; names.add(name);
        addResult({...output,name,limitBytes:runLimit,parts:pages.length,sourceNames:pages.map(itemLabel)});
      }
    } else if (runMode === 'merge') {
      const plan = planLongImage(batch), canvas = document.createElement('canvas');
      canvas.width = plan.width; canvas.height = plan.height;
      try {
        const context = canvas.getContext('2d'); if (!context) throw new Error('无法生成长图，请减少选择的项目后重试');
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); let y = 0;
        for (let index = 0; index < batch.length; index++) {
          abortIfCancelled(); showProgress('正在拼接 ' + (index + 1) + '/' + batch.length + ' · ' + itemLabel(batch[index]), index / batch.length * 85);
          const part = await renderItem(batch[index], plan.width);
          try {context.drawImage(part, 0, y, plan.width, plan.heights[index]);} finally {part.width = part.height = 1;}
          y += plan.heights[index]; await tick();
        }
        abortIfCancelled(); showProgress('正在将整张长图压缩至 ' + size(runLimit) + ' 以内…',90);
        const output = await compressCanvas(canvas,runFormat,runLimit,() => cancelled); abortIfCancelled();
        addResult({...output,limitBytes:runLimit,name:'网申材料_长图_' + batch.length + '项.' + runFormat,parts:batch.length,sourceNames:batch.map(itemLabel)});
      } finally {canvas.width = canvas.height = 1;}
    } else {
      const names = new Set();
      for (let index = 0; index < batch.length; index++) {
        abortIfCancelled(); const item = batch[index]; let canvas;
        showProgress('正在压缩 ' + (index + 1) + '/' + batch.length + ' · ' + itemLabel(item), index / batch.length * 100);
        try {
          canvas = await renderItem(item,Math.min(2400, item.width * (item.kind === 'pdf' ? 2.5 : 1)),5000);
          const output = await compressCanvas(canvas,runFormat,runLimit,() => cancelled); abortIfCancelled();
          const stem = item.fileName.replace(/\.(pdf|png|jpe?g)$/i,'') + (item.page ? '_第' + String(item.page).padStart(2,'0') + '页' : '');
          let name = stem + '.' + runFormat, suffix = 2; while (names.has(name)) name = stem + '_' + suffix++ + '.' + runFormat;
          names.add(name); addResult({...output,name,limitBytes:runLimit});
        } catch (error) {if (error.name === 'AbortError') throw error; errors.push(itemLabel(item) + '：处理失败，请检查材料后重试');}
        finally {if (canvas) canvas.width = canvas.height = 1;}
        await tick();
      }
    }
    showProgress('处理完成 · 本次选择 ' + batch.length + ' 项，生成 ' + results.length + ' 个文件',100);
  } catch (error) {
    if (error.name === 'AbortError') showProgress('已取消 · 已生成的文件仍可下载');
    else {errors.push(error.message || '处理失败，请减少选择的材料后重试'); showProgress('本次处理未完成');}
  } finally {
    $('count').textContent = results.length + ' 个文件';
    $('download-all').textContent = results.length === 1 ? '下载文件' : '打包下载 ZIP';
    $('result-note').textContent = '下载前请放大检查清晰度。' + (results.length > 1 ? ' ZIP 需解压后上传其中的文件。' : '');
    setBusy(false); $('cancel').disabled = true; observeThumbnails(); message(errors.join('\n'));
  }
};
$('download-all').onclick = async () => {
  if (busy || !results.length) return;
  if (results.length === 1) {downloadBlob(results[0].url,results[0].name); return;}
  setBusy(true); $('download-all').textContent = '正在打包…';
  try {
    const zip = new JSZip(); results.forEach(result => zip.file(result.name,result.blob));
    const blob = await zip.generateAsync({type:'blob',compression:'STORE'}), url = URL.createObjectURL(blob);
    downloadBlob(url,'网申材料.zip'); setTimeout(() => URL.revokeObjectURL(url),60000);
  } catch {message('打包失败，请尝试逐个下载。');}
  finally {setBusy(false); $('download-all').textContent = '打包下载 ZIP'; observeThumbnails();}
};
setLimit(200);
