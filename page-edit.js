'use strict';
/* Page coordinates are normalized against the original, rotated PDF.js viewport. */
window.PageEdit = (() => {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const fullCrop = () => ({x:0,y:0,w:1,h:1});
  function crop(item) {return item.edits?.crop || fullCrop();}
  function normalizeCrop(value) {
    const x=clamp(Number(value.x)||0,0,.97),y=clamp(Number(value.y)||0,0,.97);
    return {x,y,w:clamp(Number(value.w)||.03,.03,1-x),h:clamp(Number(value.h)||.03,.03,1-y)};
  }
  function dimensions(item) {const c=crop(item);return {width:item.width*c.w,height:item.height*c.h};}
  function changed(item) {const c=crop(item);return c.x>.00001||c.y>.00001||c.w<.99999||c.h<.99999||!!item.edits?.overlays?.length;}
  function image(url) {return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('图片无法读取'));im.src=url;});}
  async function render(item, original, width, maxHeight) {
    const c=crop(item),base=await original(item,width/c.w,maxHeight/c.h);
    if (!changed(item)) return base;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(base.width*c.w));canvas.height=Math.max(1,Math.round(base.height*c.h));
    try {
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(base,c.x*base.width,c.y*base.height,c.w*base.width,c.h*base.height,0,0,canvas.width,canvas.height);
      for (const overlay of item.edits?.overlays || []) {
        const im=await image(overlay.url);
        ctx.drawImage(im,(overlay.x-c.x)*base.width,(overlay.y-c.y)*base.height,overlay.w*base.width,overlay.h*base.height);
      }
      return canvas;
    } catch(error) {canvas.width=canvas.height=1;throw error;}
    finally {base.width=base.height=1;}
  }
  function pdfGeometry(viewport, rect) {
    const point=(x,y)=>viewport.convertToPdfPoint(x*viewport.width,y*viewport.height);
    const a=point(rect.x,rect.y),b=point(rect.x+rect.w,rect.y+rect.h),bl=point(rect.x,rect.y+rect.h),br=point(rect.x+rect.w,rect.y+rect.h),tl=point(rect.x,rect.y);
    return {x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(a[0]-b[0]),height:Math.abs(a[1]-b[1]),imageX:bl[0],imageY:bl[1],imageWidth:Math.hypot(br[0]-bl[0],br[1]-bl[1]),imageHeight:Math.hypot(tl[0]-bl[0],tl[1]-bl[1]),angle:Math.atan2(br[1]-bl[1],br[0]-bl[0])*180/Math.PI};
  }
  const $=id=>document.getElementById(id);
  let options,session=null,nextOverlay=0,gesture=null;
  const selected=()=>session?.draft.overlays.find(o=>o.id===session.selectedId);
  const field=(id,n)=>{if (document.activeElement!==$(id)) $(id).value=Math.round(n*1000)/10;};
  function setWorking(value) {
    if (!session) return;session.working=value;
    ['editor-save','editor-add-image','editor-reset-page','editor-reset-crop','editor-crop-mode','editor-image-mode','editor-apply-all','crop-x','crop-y','crop-w','crop-h','image-x','image-y','image-w','editor-delete-image'].forEach(id=>$(id).disabled=value);
    $('editor-stage').classList.toggle('working',value);
  }
  function setMode(mode) {
    if (!session) return;session.mode=mode;
    $('editor-crop-mode').classList.toggle('active',mode==='crop');$('editor-image-mode').classList.toggle('active',mode==='image');
    $('editor-crop-mode').setAttribute('aria-pressed',String(mode==='crop'));$('editor-image-mode').setAttribute('aria-pressed',String(mode==='image'));
    $('editor-stage').classList.toggle('image-mode',mode==='image');
    $('editor-instruction').textContent=mode==='crop'?'拖动框选保留区域，或拖动四角与中间调整裁剪框。':'点击贴图后拖动定位，拖动右下角等比例缩放。也可输入右侧百分比精确调整。';
    paint();
  }
  function paint() {
    if (!session) return;
    const c=session.draft.crop,box=$('editor-crop-box');Object.assign(box.style,{left:c.x*100+'%',top:c.y*100+'%',width:c.w*100+'%',height:c.h*100+'%'});
    field('crop-x',c.x);field('crop-y',c.y);field('crop-w',c.w);field('crop-h',c.h);
    $('editor-overlays').replaceChildren();$('editor-image-list').replaceChildren();
    session.draft.overlays.forEach((overlay,index)=>{
      const frame=document.createElement('div');frame.className='editor-overlay'+(session.selectedId===overlay.id?' selected':'');frame.dataset.overlay=overlay.id;frame.tabIndex=0;frame.setAttribute('role','button');frame.setAttribute('aria-label','贴图 '+(index+1)+' '+overlay.name);
      Object.assign(frame.style,{left:overlay.x*100+'%',top:overlay.y*100+'%',width:overlay.w*100+'%',height:overlay.h*100+'%'});
      const im=new Image();im.src=overlay.url;im.alt=overlay.name;im.draggable=false;frame.append(im);
      const handle=document.createElement('span');handle.className='image-resize';handle.dataset.resize=overlay.id;frame.append(handle);$('editor-overlays').append(frame);
      const choose=document.createElement('button');choose.className='editor-image-choice'+(session.selectedId===overlay.id?' active':'');choose.textContent=(index+1)+'. '+overlay.name;choose.setAttribute('aria-label','选择贴图 '+(index+1)+' '+overlay.name);choose.disabled=session.working;
      choose.onclick=()=>{session.selectedId=overlay.id;setMode('image');};$('editor-image-list').append(choose);
    });
    const overlay=selected();$('editor-image-controls').hidden=!overlay;
    if (overlay) {field('image-x',overlay.x);field('image-y',overlay.y);field('image-w',overlay.w);}
    if (!session.draft.overlays.length) {$('editor-image-list').textContent='本页尚未添加图片';}
  }
  function close(save=false) {
    if (!session) return;
    const old=session;session=null;gesture=null;
    const retained=new Set(save?old.draft.overlays.map(o=>o.url):[]);
    for (const url of old.createdUrls) if (!retained.has(url)) URL.revokeObjectURL(url);
    if (old.backgroundUrl) URL.revokeObjectURL(old.backgroundUrl);
    $('editor-base').removeAttribute('src');$('editor-overlays').replaceChildren();
    if ($('page-editor').open) $('page-editor').close();
    options.onBusy(false);
  }
  function fitStage() {
    if (!session) return;const host=$('editor-stage-scroll');
    $('editor-stage').style.width=Math.max(80,Math.min(650,host.clientWidth-32,(host.clientHeight-32)*session.item.width/session.item.height))+'px';
  }
  async function open(item) {
    if (session) return;
    options.onBusy(true);
    const draft={crop:{...crop(item)},overlays:(item.edits?.overlays||[]).map(o=>({...o}))};
    const current={item,draft,mode:'crop',selectedId:null,working:true,createdUrls:new Set(),backgroundUrl:null};session=current;
    $('editor-page-name').textContent=item.fileName+' · 第 '+item.page+' 页';$('editor-message').textContent='正在加载页面…';$('editor-apply-all').checked=false;
    $('editor-stage').style.aspectRatio=item.width+'/'+item.height;$('editor-base').removeAttribute('src');$('editor-overlays').replaceChildren();
    $('page-editor').showModal();setWorking(true);setMode('crop');fitStage();let canvas;
    try {
      await options.waitThumbnails();if (session!==current) return;
      canvas=await options.renderOriginal(item,Math.min(1600,item.width*2.5),2400);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if (session!==current) return;if (!blob) throw new Error('无法加载页面预览');
      current.backgroundUrl=URL.createObjectURL(blob);$('editor-base').src=current.backgroundUrl;$('editor-message').textContent='编辑仅在点击“保存本页编辑”后生效。';
      setWorking(false);paint();
    } catch(error) {if (session===current) {$('editor-message').textContent=error.message;$('editor-save').disabled=true;}}
    finally {if (canvas) canvas.width=canvas.height=1;}
  }
  async function addImages(files) {
    if (!session||session.working) return;const current=session;setWorking(true);const errors=[];
    for (const file of files) {
      if (session!==current) break;let inputUrl,canvas;
      try {
        if (!/\.(png|jpe?g)$/i.test(file.name)) throw new Error('仅支持 PNG、JPG、JPEG');
        if (file.size>50*1024*1024) throw new Error('超过单张 50MB 限制');
        inputUrl=URL.createObjectURL(file);const im=await image(inputUrl);
        const scale=Math.min(1,2400/Math.max(im.naturalWidth,im.naturalHeight),Math.sqrt(8000000/(im.naturalWidth*im.naturalHeight)));
        canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
        const type=/\.png$/i.test(file.name)?'image/png':'image/jpeg';const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,.94));
        if (session!==current) break;if (!blob) throw new Error('图片编码失败');
        const url=URL.createObjectURL(blob);current.createdUrls.add(url);
        const c=current.draft.crop,ratio=canvas.height/canvas.width*current.item.width/current.item.height;
        const w=Math.min(c.w*.28,c.h*.35/ratio),h=w*ratio;
        const overlay={id:'overlay-'+(++nextOverlay),name:file.name,blob,url,x:c.x+c.w-w-c.w*.04,y:c.y+c.h*.04,w,h};
        current.draft.overlays.push(overlay);current.selectedId=overlay.id;
      } catch(error) {errors.push(file.name+'：'+error.message);}
      finally {if (inputUrl) URL.revokeObjectURL(inputUrl);if (canvas) canvas.width=canvas.height=1;}
    }
    if (session===current) {setWorking(false);setMode('image');$('editor-message').textContent=errors.join('\n')||'图片已添加，拖动可调整位置，右下角可等比例缩放。';}
  }
  function point(event) {const rect=$('editor-stage').getBoundingClientRect();return {x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)};}
  function pointerDown(event) {
    if (!session||session.working||event.button!==0) return;
    const p=point(event),overlayNode=event.target.closest('[data-overlay]'),corner=event.target.dataset.corner;
    if (session.mode==='image') {
      if (!overlayNode) {session.selectedId=null;paint();return;}
      session.selectedId=overlayNode.dataset.overlay;const overlay=selected();gesture={type:event.target.dataset.resize?'resize-image':'move-image',start:p,original:{...overlay}};
    } else {
      const c=session.draft.crop,isFull=c.x<.00001&&c.y<.00001&&c.w>.99999&&c.h>.99999;
      gesture={type:corner?'crop-'+corner:(!isFull&&event.target.closest('#editor-crop-box')?'move-crop':'new-crop'),start:p,original:{...c}};
    }
    event.preventDefault();$('editor-stage').setPointerCapture(event.pointerId);paint();
  }
  function pointerMove(event) {
    if (!session||!gesture) return;
    const p=point(event),g=gesture,o=g.original,dx=p.x-g.start.x,dy=p.y-g.start.y;
    if (g.type==='move-image') {const im=selected();im.x=clamp(o.x+dx,0,1-o.w);im.y=clamp(o.y+dy,0,1-o.h);}
    else if (g.type==='resize-image') {
      const im=selected(),ratio=o.h/o.w,max=Math.min(1-o.x,(1-o.y)/ratio);im.w=clamp(Math.max(p.x-o.x,(p.y-o.y)/ratio),Math.min(.01,max),max);im.h=im.w*ratio;
    } else if (g.type==='move-crop') session.draft.crop={...o,x:clamp(o.x+dx,0,1-o.w),y:clamp(o.y+dy,0,1-o.h)};
    else if (g.type==='new-crop') session.draft.crop=normalizeCrop({x:Math.min(p.x,g.start.x),y:Math.min(p.y,g.start.y),w:Math.abs(dx),h:Math.abs(dy)});
    else {
      let left=o.x,right=o.x+o.w,top=o.y,bottom=o.y+o.h;
      if (g.type.includes('w')) left=clamp(p.x,0,right-.03);if (g.type.includes('e')) right=clamp(p.x,left+.03,1);
      if (g.type.includes('n')) top=clamp(p.y,0,bottom-.03);if (g.type.includes('s')) bottom=clamp(p.y,top+.03,1);
      session.draft.crop={x:left,y:top,w:right-left,h:bottom-top};
    }
    paint();
  }
  function removeSelected() {if (!session||session.working) return;session.draft.overlays=session.draft.overlays.filter(o=>o.id!==session.selectedId);session.selectedId=null;paint();}
  function init(config) {
    options=config;new ResizeObserver(()=>fitStage()).observe($('editor-stage-scroll'));
    $('editor-close').onclick=()=>close();$('page-editor').oncancel=event=>{event.preventDefault();close();};$('page-editor').onclose=()=>{if (session) close();};
    $('editor-crop-mode').onclick=()=>setMode('crop');$('editor-image-mode').onclick=()=>setMode('image');
    $('editor-reset-crop').onclick=()=>{session.draft.crop=fullCrop();paint();};
    $('editor-reset-page').onclick=()=>{session.draft={crop:fullCrop(),overlays:[]};session.selectedId=null;paint();};
    $('editor-add-image').onclick=()=>$('editor-image-file').click();
    $('editor-image-file').onchange=event=>{const files=Array.from(event.target.files);event.target.value='';addImages(files);};
    $('editor-delete-image').onclick=removeSelected;
    for (const key of ['x','y','w','h']) $('crop-'+key).oninput=()=>{
      if (!session||session.working) return;const values=Object.fromEntries(['x','y','w','h'].map(k=>[k,$('crop-'+k).valueAsNumber/100]));
      if (Object.values(values).every(Number.isFinite)) {session.draft.crop=normalizeCrop(values);paint();}
    };
    for (const key of ['x','y','w']) $('image-'+key).oninput=()=>{
      const im=selected();if (!im||session.working) return;const value=$('image-'+key).valueAsNumber/100;if (!Number.isFinite(value)) {paint();return;}
      if (key==='w') {const ratio=im.h/im.w,max=Math.min(1-im.x,(1-im.y)/ratio);im.w=clamp(value,Math.min(.01,max),max);im.h=im.w*ratio;}
      else im[key]=clamp(value,0,1-im[key==='x'?'w':'h']);paint();
    };
    for (const id of ['crop-x','crop-y','crop-w','crop-h','image-x','image-y','image-w']) $(id).onblur=()=>paint();
    $('editor-save').onclick=()=>{
      if (!session||session.working) return;
      session.draft.crop=normalizeCrop(session.draft.crop);
      options.onCommit(session.item,session.draft,$('editor-apply-all').checked);close(true);
    };
    $('editor-stage').onpointerdown=pointerDown;$('editor-stage').onpointermove=pointerMove;
    $('editor-stage').onpointerup=()=>{gesture=null;};$('editor-stage').onpointercancel=()=>{gesture=null;};
    $('editor-stage').onkeydown=event=>{if ((event.key==='Delete'||event.key==='Backspace')&&selected()) {event.preventDefault();removeSelected();}};
  }
  return {crop,normalizeCrop,dimensions,changed,render,pdfGeometry,init,open};
})();
