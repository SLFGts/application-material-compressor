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
  function orientation(item) {return {rotation:0,flipX:false,flipY:false,...item.orientation};}
  function dimensions(item) {const c=crop(item),o=orientation(item),swap=o.rotation%180!==0;return {width:(swap?item.height*c.h:item.width*c.w),height:(swap?item.width*c.w:item.height*c.h)};}
  function orientCanvas(base,item) {
    const o=orientation(item);if (!o.rotation&&!o.flipX&&!o.flipY) return base;
    const canvas=document.createElement('canvas'),swap=o.rotation%180!==0;
    canvas.width=swap?base.height:base.width;canvas.height=swap?base.width:base.height;
    try {const ctx=canvas.getContext('2d');ctx.translate(canvas.width/2,canvas.height/2);ctx.scale(o.flipX?-1:1,o.flipY?-1:1);ctx.rotate(o.rotation*Math.PI/180);ctx.drawImage(base,-base.width/2,-base.height/2);return canvas;}
    catch(error){canvas.width=canvas.height=1;throw error;}
    finally {base.width=base.height=1;}
  }
  function contentChanged(item) {const c=crop(item);return c.x>.00001||c.y>.00001||c.w<.99999||c.h<.99999||!!item.edits?.overlays?.length;}
  function changed(item) {const o=orientation(item);return contentChanged(item)||!!(o.rotation||o.flipX||o.flipY);}
  function image(url) {return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('图片无法读取'));im.src=url;});}
  async function render(item, original, width, maxHeight) {
    const c=crop(item),d=dimensions(item),scale=Math.min(width/d.width,maxHeight/d.height),base=await original(item,item.width*scale,item.height*scale);
    if (!contentChanged(item)) return orientCanvas(base,item);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(base.width*c.w));canvas.height=Math.max(1,Math.round(base.height*c.h));
    try {
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(base,c.x*base.width,c.y*base.height,c.w*base.width,c.h*base.height,0,0,canvas.width,canvas.height);
      for (const overlay of item.edits?.overlays || []) {
        const im=await image(overlay.url);
        ctx.drawImage(im,(overlay.x-c.x)*base.width,(overlay.y-c.y)*base.height,overlay.w*base.width,overlay.h*base.height);
      }
      return orientCanvas(canvas,item);
    } catch(error) {canvas.width=canvas.height=1;throw error;}
    finally {base.width=base.height=1;}
  }
  function pdfGeometry(viewport, rect) {
    const point=(x,y)=>viewport.convertToPdfPoint(x*viewport.width,y*viewport.height);
    const a=point(rect.x,rect.y),b=point(rect.x+rect.w,rect.y+rect.h),bl=point(rect.x,rect.y+rect.h),br=point(rect.x+rect.w,rect.y+rect.h),tl=point(rect.x,rect.y);
    return {x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(a[0]-b[0]),height:Math.abs(a[1]-b[1]),imageX:bl[0],imageY:bl[1],imageWidth:Math.hypot(br[0]-bl[0],br[1]-bl[1]),imageHeight:Math.hypot(tl[0]-bl[0],tl[1]-bl[1]),angle:Math.atan2(br[1]-bl[1],br[0]-bl[0])*180/Math.PI};
  }
  const $=id=>document.getElementById(id);
  const cloneState=s=>({crop:{...s.crop},overlays:s.overlays.map(o=>({...o})),orientation:{...s.orientation}});
  const originalState=()=>({crop:fullCrop(),overlays:[],orientation:{rotation:0,flipX:false,flipY:false}});
  const snapshot=item=>({crop:{...crop(item)},overlays:(item.edits?.overlays||[]).map(o=>({...o})),orientation:orientation(item)});
  const key=s=>JSON.stringify(s);
  function historyFor(item) {
    if (item.editHistory) return {states:item.editHistory.states.map(cloneState),index:item.editHistory.index};
    const initial=originalState(),current=snapshot(item),states=key(initial)===key(current)?[current]:[initial,current];
    return {states,index:states.length-1};
  }
  function appendHistory(history,state) {
    if (key(history.states[history.index])===key(state)) return;
    history.states=history.states.slice(0,history.index+1);history.states.push(cloneState(state));history.index++;
  }
  function overlayUrls(item) {return new Set([...(item.edits?.overlays||[]),...(item.editHistory?.states||[]).flatMap(s=>s.overlays)].map(o=>o.url));}
  function applyCrop(item,value) {const history=historyFor(item),state=snapshot(item);state.crop={...value};appendHistory(history,state);item.edits={crop:state.crop,overlays:state.overlays};item.editHistory=history;}
  let options,session=null,nextOverlay=0,gesture=null;
  const selected=()=>session?.draft.overlays.find(o=>o.id===session.selectedId);
  const field=(id,n)=>{if (document.activeElement!==$(id)) $(id).value=Math.round(n*1000)/10;};
  function checkpoint(){if(session&&!session.working){const before=key(session.history.states[session.history.index]);appendHistory(session.history,session.draft);if(session.entries.length>1&&before!==key(session.draft))renderPages();}}
  function stashCurrent(){if(!session)return;const entry=session.entries[session.activeIndex];entry.draft=session.draft;entry.history=session.history;}
  function updatePageNavigation(){
    if(!session)return;const multi=session.entries.length>1;
    $('editor-pages').hidden=!multi;$('page-editor').classList.toggle('has-pages',multi);
    $('editor-pages-count').textContent=session.entries.filter(e=>e.selected).length+'/'+session.entries.length+' 页';$('editor-pages-count').title='已选页数 / 总页数';
    $('editor-page-up').disabled=session.working||session.activeIndex===0;
    $('editor-page-down').disabled=session.working||session.activeIndex===session.entries.length-1;
    $('editor-apply-crop-all').disabled=session.working||!multi;
    $('editor-apply-all-row').hidden=!multi;
  }
  function renderPages(){
    if(!session)return;const current=session;stashCurrent();current.pageObserver?.disconnect();const list=$('editor-page-list'),scrollTop=list.scrollTop,scrollLeft=list.scrollLeft;list.replaceChildren();
    current.entries.forEach((entry,index)=>{
      const tile=document.createElement('div');tile.className='editor-page-tile'+(index===current.activeIndex?' active':'')+(!entry.selected?' excluded':'');
      const check=document.createElement('input');check.type='checkbox';check.checked=entry.selected;check.disabled=current.working;check.setAttribute('aria-label','导出第 '+entry.item.page+' 页');check.onchange=()=>{entry.selected=check.checked;tile.classList.toggle('excluded',!entry.selected);updateHistoryControls();updatePageNavigation();};
      const choose=document.createElement('button');choose.type='button';choose.className='editor-page-pick';choose.dataset.entryId=entry.item.id;choose.setAttribute('aria-label','编辑第 '+entry.item.page+' 页');choose.setAttribute('aria-current',String(index===current.activeIndex));choose.disabled=current.working;
      const stamp=key(entry.draft),cached=current.navUrls.get(entry.item.id);
      if(cached&&cached.key===stamp){const im=new Image();im.src=cached.url;im.alt='第 '+entry.item.page+' 页';choose.append(im);}else choose.append(UIIcons.svg('file'));
      choose.append(Object.assign(document.createElement('span'),{textContent:'第 '+entry.item.page+' 页'}));choose.onclick=()=>switchPage(index);
      tile.append(check,choose);$('editor-page-list').append(tile);
    });updatePageNavigation();list.scrollTop=scrollTop;list.scrollLeft=scrollLeft;
    const active=list.querySelector('[aria-current="true"]');if(active&&current.entries.length>1){const a=active.getBoundingClientRect(),r=list.getBoundingClientRect();if(a.top<r.top)list.scrollTop-=r.top-a.top;else if(a.bottom>r.bottom)list.scrollTop+=a.bottom-r.bottom;if(a.left<r.left)list.scrollLeft-=r.left-a.left;else if(a.right>r.right)list.scrollLeft+=a.right-r.right;}
    if(current.entries.length<2)return;
    current.pageObserver=new IntersectionObserver(entries=>{
      for(const target of entries){if(!target.isIntersecting)continue;current.pageObserver.unobserve(target.target);const entry=current.entries.find(e=>e.item.id===target.target.dataset.entryId);if(!entry)continue;
        const stamp=key(entry.draft),cached=current.navUrls.get(entry.item.id);if(cached?.key===stamp)continue;
        current.navChain=current.navChain.then(async()=>{if(session!==current||key(entry.draft)!==stamp)return;let canvas;try{
          const virtual={...entry.item,edits:entry.draft,orientation:entry.draft.orientation};canvas=await render(virtual,options.renderOriginal,100,130);const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.65));
          if(!blob||session!==current||key(entry.draft)!==stamp)return;
          const old=current.navUrls.get(entry.item.id);if(old)URL.revokeObjectURL(old.url);const url=URL.createObjectURL(blob);current.navUrls.set(entry.item.id,{key:stamp,url});
          const node=$('editor-page-list').querySelector('[data-entry-id="'+entry.item.id+'"]');if(node){node.querySelectorAll('svg,img').forEach(n=>n.remove());const im=new Image();im.src=url;im.alt='第 '+entry.item.page+' 页';node.prepend(im);}
        }catch{}finally{if(canvas)canvas.width=canvas.height=1;}});
      }
    },{root:$('editor-page-list'),rootMargin:'120px'});
    $('editor-page-list').querySelectorAll('.editor-page-pick').forEach(n=>current.pageObserver.observe(n));
  }
  async function loadActivePage(){
    if(!session)return;const current=session,serial=++current.generation;setWorking(true);$('editor-base').removeAttribute('src');$('editor-message').textContent='正在加载…';$('editor-overlays').replaceChildren();
    $('editor-page-name').textContent=current.item.fileName+(current.item.page?' · 第 '+current.item.page+' 页':'');$('editor-pdf-note').hidden=current.item.kind!=='pdf';fitStage();renderPages();let canvas;
    try{
      await options.waitThumbnails();if(session!==current||serial!==current.generation)return;
      canvas=await options.renderOriginal(current.item,Math.min(1600,current.item.width*2.5),2400);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
      if(session!==current||serial!==current.generation)return;if(!blob)throw new Error('无法加载预览');if(current.backgroundUrl)URL.revokeObjectURL(current.backgroundUrl);
      current.backgroundUrl=URL.createObjectURL(blob);$('editor-base').src=current.backgroundUrl;$('editor-message').textContent='';setWorking(false);paint();renderPages();
    }catch(error){if(session===current&&serial===current.generation){$('editor-message').textContent=error.message;setWorking(false);$('editor-save').disabled=true;}}
    finally{if(canvas)canvas.width=canvas.height=1;}
  }
  async function switchPage(index){
    if(!session||session.working||index===session.activeIndex)return;checkpoint();stashCurrent();const entry=session.entries[index];session.activeIndex=index;session.item=entry.item;session.draft=entry.draft;session.history=entry.history;session.savedKey=entry.savedKey;session.selectedId=null;gesture=null;await loadActivePage();
  }
  function movePage(delta){
    if(!session||session.working)return;checkpoint();stashCurrent();const from=session.activeIndex,to=from+delta;if(to<0||to>=session.entries.length)return;
    [session.entries[from],session.entries[to]]=[session.entries[to],session.entries[from]];session.activeIndex=to;renderPages();updateHistoryControls();
    $('editor-page-list').querySelector('[aria-current="true"]')?.focus();
  }
  function copyCropToPages(){
    if(!session||session.working)return;checkpoint();stashCurrent();for(const entry of session.entries){if(entry.item===session.item)continue;entry.draft.crop={...session.draft.crop};appendHistory(entry.history,entry.draft);}
    renderPages();updateHistoryControls();
  }
  function updateHistoryControls() {
    if (!session) return;stashCurrent();const h=session.history;
    $('editor-undo').disabled=session.working||h.index===0;
    $('editor-redo').disabled=session.working||h.index===h.states.length-1;
    $('editor-reset-page').disabled=session.working||key(session.draft)===key(originalState());
    const dirty=session.entries.some(e=>key(e.draft)!==e.savedKey||e.selected!==e.savedSelected)||session.entries.map(e=>e.item.id).join()!==session.initialOrder;
    $('editor-change-status').textContent=dirty?'有未保存的修改':'未修改';
  }
  function setWorking(value) {
    if (!session) return;session.working=value;
    $('page-editor').querySelectorAll('button,input').forEach(el=>{if(el.id!=='editor-close')el.disabled=value;});
    $('editor-stage').classList.toggle('working',value);updateHistoryControls();updatePageNavigation();
  }
  function mutate(action) {if(!session||session.working)return;checkpoint();action();checkpoint();paint();}
  function travel(delta) {
    if(!session||session.working)return;if(document.activeElement?.matches('#page-editor input'))document.activeElement.blur();checkpoint();const h=session.history,next=h.index+delta;
    if(next<0||next>=h.states.length)return;h.index=next;session.draft=cloneState(h.states[next]);session.selectedId=null;paint();renderPages();
  }
  function rotate(action) {mutate(()=>{const o=session.draft.orientation;
    if(action==='left'||action==='right'){o.rotation=(o.rotation+(action==='left'?270:90))%360;[o.flipX,o.flipY]=[o.flipY,o.flipX];}
    else if(action==='horizontal')o.flipX=!o.flipX;else if(action==='vertical')o.flipY=!o.flipY;else session.draft.orientation=originalState().orientation;
  });}
  function setMode(mode) {
    if(!session)return;checkpoint();session.mode=mode;
    for(const name of ['crop','image','direction']) {
      $('editor-'+name+'-mode').classList.toggle('active',mode===name);
      $('editor-'+name+'-mode').setAttribute('aria-selected',String(mode===name));$('editor-'+name+'-mode').tabIndex=mode===name?0:-1;
      $('editor-'+name+'-panel').hidden=mode!==name;
    }
    $('editor-stage').classList.toggle('image-mode',mode==='image');$('editor-stage').classList.toggle('direction-mode',mode==='direction');
    $('editor-instruction').textContent={crop:'拖动框选保留范围，拖动四角调整。',image:'添加图片后，拖动定位，拖动角点缩放。',direction:'旋转或翻转当前材料，裁剪与贴图随之调整。'}[mode];paint();
  }
  function fitStage() {
    if(!session)return;const host=$('editor-stage-scroll'),o=session.draft.orientation,swap=o.rotation%180!==0;
    const iw=session.item.width,ih=session.item.height,dw=swap?ih:iw,dh=swap?iw:ih;
    const scale=Math.max(.01,Math.min(650/dw,(host.clientWidth-40)/dw,(host.clientHeight-40)/dh));
    const stage=$('editor-stage'),frame=$('editor-stage-frame');
    Object.assign(frame.style,{width:dw*scale+'px',height:dh*scale+'px'});
    Object.assign(stage.style,{width:iw*scale+'px',height:ih*scale+'px',transform:'translate(-50%,-50%) scale('+(o.flipX?-1:1)+','+(o.flipY?-1:1)+') rotate('+o.rotation+'deg)'});
  }
  function paint() {
    if(!session)return;fitStage();const c=session.draft.crop,box=$('editor-crop-box');
    Object.assign(box.style,{left:c.x*100+'%',top:c.y*100+'%',width:c.w*100+'%',height:c.h*100+'%'});
    for(const k of ['x','y','w','h'])field('crop-'+k,c[k]);
    $('editor-overlays').replaceChildren();$('editor-image-list').replaceChildren();
    session.draft.overlays.forEach((overlay,index)=>{
      const frame=document.createElement('div');frame.className='editor-overlay'+(session.selectedId===overlay.id?' selected':'');frame.dataset.overlay=overlay.id;frame.tabIndex=session.mode==='image'?0:-1;frame.setAttribute('role','button');frame.setAttribute('aria-label','贴图 '+(index+1)+' '+overlay.name);
      Object.assign(frame.style,{left:overlay.x*100+'%',top:overlay.y*100+'%',width:overlay.w*100+'%',height:overlay.h*100+'%'});
      const im=new Image();im.src=overlay.url;im.alt=overlay.name;im.draggable=false;frame.append(im);
      const handle=document.createElement('span');handle.className='image-resize';handle.dataset.resize=overlay.id;frame.append(handle);$('editor-overlays').append(frame);
      const choose=document.createElement('button');choose.className='editor-image-choice'+(session.selectedId===overlay.id?' active':'');choose.textContent=(index+1)+'. '+overlay.name;choose.setAttribute('aria-label','选择贴图 '+(index+1)+' '+overlay.name);choose.disabled=session.working;
      choose.onclick=()=>{session.selectedId=overlay.id;setMode('image');};$('editor-image-list').append(choose);
    });
    const overlay=selected();$('editor-image-controls').hidden=!overlay;
    if(overlay){field('image-x',overlay.x);field('image-y',overlay.y);field('image-w',overlay.w);}
    if(!session.draft.overlays.length)$('editor-image-list').textContent='尚未添加贴图';
    const o=session.draft.orientation;
    $('editor-flip-horizontal').setAttribute('aria-pressed',String(o.flipX));$('editor-flip-vertical').setAttribute('aria-pressed',String(o.flipY));
    $('editor-direction-status').textContent='旋转 '+o.rotation+'°'+(o.flipX?' · 水平翻转':'')+(o.flipY?' · 垂直翻转':'');
    updateHistoryControls();
  }
  function close(save=false){
    if(!session)return;stashCurrent();const old=session;session=null;gesture=null;old.pageObserver?.disconnect();
    const retained=new Set(save?old.entries.flatMap(e=>e.history.states.flatMap(s=>s.overlays.map(o=>o.url))):[]);
    for(const url of old.createdUrls)if(!retained.has(url))URL.revokeObjectURL(url);
    if(old.backgroundUrl)URL.revokeObjectURL(old.backgroundUrl);for(const cached of old.navUrls.values())URL.revokeObjectURL(cached.url);
    $('editor-base').removeAttribute('src');$('editor-overlays').replaceChildren();$('editor-page-list').replaceChildren();if($('page-editor').open)$('page-editor').close();options.onBusy(false);
    document.getElementById(old.item.sourceId||old.item.id)?.querySelector('.item-edit-button')?.focus();
  }
  async function open(item,fileItems){
    if(session)return;options.onBusy(true);const members=fileItems||[item],entries=members.map(item=>{const draft=snapshot(item);return {item,draft,history:historyFor(item),savedKey:key(draft),selected:item.selected!==false,savedSelected:item.selected!==false};});
    const index=Math.max(0,entries.findIndex(e=>e.item===item)),entry=entries[index];
    session={item:entry.item,draft:entry.draft,history:entry.history,savedKey:entry.savedKey,entries,activeIndex:index,initialOrder:entries.map(e=>e.item.id).join(),fileMode:!!fileItems,mode:'crop',selectedId:null,working:true,createdUrls:new Set(),backgroundUrl:null,navUrls:new Map(),navChain:Promise.resolve(),generation:0};
    $('editor-base').alt='待编辑材料';$('page-editor').showModal();setWorking(true);setMode('crop');await loadActivePage();
  }
  async function addImages(files) {
    if(!session||session.working)return;checkpoint();const current=session;setWorking(true);const errors=[];
    for(const file of files){if(session!==current)break;let inputUrl,canvas;
      try{
        if(!/\.(png|jpe?g)$/i.test(file.name))throw new Error('仅支持 PNG、JPG、JPEG');if(file.size>50*1024*1024)throw new Error('超过单张 50MB 限制');
        inputUrl=URL.createObjectURL(file);const im=await image(inputUrl),scale=Math.min(1,2400/Math.max(im.naturalWidth,im.naturalHeight),Math.sqrt(8000000/(im.naturalWidth*im.naturalHeight)));
        canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
        const type=/\.png$/i.test(file.name)?'image/png':'image/jpeg',blob=await new Promise(resolve=>canvas.toBlob(resolve,type,.94));if(session!==current)break;if(!blob)throw new Error('图片编码失败');
        const url=URL.createObjectURL(blob);current.createdUrls.add(url);const c=current.draft.crop,ratio=canvas.height/canvas.width*current.item.width/current.item.height,w=Math.min(c.w*.28,c.h*.35/ratio),h=w*ratio;
        const overlay={id:'overlay-'+(++nextOverlay),name:file.name,blob,url,x:c.x+c.w-w-c.w*.04,y:c.y+c.h*.04,w,h};current.draft.overlays.push(overlay);current.selectedId=overlay.id;
      }catch(error){errors.push(file.name+'：'+error.message);}finally{if(inputUrl)URL.revokeObjectURL(inputUrl);if(canvas)canvas.width=canvas.height=1;}
    }
    if(session===current){setWorking(false);checkpoint();setMode('image');$('editor-message').textContent=errors.join('\n');}
  }
  function point(event) {
    const rect=$('editor-stage-frame').getBoundingClientRect(),stage=$('editor-stage'),o=session.draft.orientation;
    const dx=(event.clientX-rect.left-rect.width/2)*(o.flipX?-1:1),dy=(event.clientY-rect.top-rect.height/2)*(o.flipY?-1:1),a=o.rotation*Math.PI/180;
    return {x:clamp((dx*Math.cos(a)+dy*Math.sin(a))/stage.offsetWidth+.5,0,1),y:clamp((-dx*Math.sin(a)+dy*Math.cos(a))/stage.offsetHeight+.5,0,1)};
  }
  function pointerDown(event) {
    if(!session||session.working||event.button!==0||session.mode==='direction')return;checkpoint();
    const p=point(event),overlayNode=event.target.closest('[data-overlay]'),corner=event.target.dataset.corner;
    if(session.mode==='image'){
      if(!overlayNode){session.selectedId=null;paint();return;}session.selectedId=overlayNode.dataset.overlay;gesture={type:event.target.dataset.resize?'resize-image':'move-image',start:p,original:{...selected()}};
    }else{const c=session.draft.crop,isFull=c.x<.00001&&c.y<.00001&&c.w>.99999&&c.h>.99999;gesture={type:corner?'crop-'+corner:(!isFull&&event.target.closest('#editor-crop-box')?'move-crop':'new-crop'),start:p,original:{...c}};}
    event.preventDefault();$('editor-stage').setPointerCapture(event.pointerId);paint();
  }
  function pointerMove(event) {
    if(!session||!gesture)return;const p=point(event),g=gesture,o=g.original,dx=p.x-g.start.x,dy=p.y-g.start.y;
    if(g.type==='move-image'){const im=selected();im.x=clamp(o.x+dx,0,1-o.w);im.y=clamp(o.y+dy,0,1-o.h);}
    else if(g.type==='resize-image'){const im=selected(),ratio=o.h/o.w,max=Math.min(1-o.x,(1-o.y)/ratio);im.w=clamp(Math.max(p.x-o.x,(p.y-o.y)/ratio),Math.min(.01,max),max);im.h=im.w*ratio;}
    else if(g.type==='move-crop')session.draft.crop={...o,x:clamp(o.x+dx,0,1-o.w),y:clamp(o.y+dy,0,1-o.h)};
    else if(g.type==='new-crop')session.draft.crop=normalizeCrop({x:Math.min(p.x,g.start.x),y:Math.min(p.y,g.start.y),w:Math.abs(dx),h:Math.abs(dy)});
    else{let left=o.x,right=o.x+o.w,top=o.y,bottom=o.y+o.h;if(g.type.includes('w'))left=clamp(p.x,0,right-.03);if(g.type.includes('e'))right=clamp(p.x,left+.03,1);if(g.type.includes('n'))top=clamp(p.y,0,bottom-.03);if(g.type.includes('s'))bottom=clamp(p.y,top+.03,1);session.draft.crop={x:left,y:top,w:right-left,h:bottom-top};}
    paint();
  }
  function removeSelected(){mutate(()=>{session.draft.overlays=session.draft.overlays.filter(o=>o.id!==session.selectedId);session.selectedId=null;});}
  function init(config) {
    options=config;new ResizeObserver(()=>fitStage()).observe($('editor-stage-scroll'));
    $('editor-close').onclick=()=>close();$('page-editor').oncancel=e=>{e.preventDefault();close();};$('page-editor').onclose=()=>{if(session&&!$('page-editor').open)close();};
    for(const name of ['crop','image','direction']){$('editor-'+name+'-mode').onclick=()=>setMode(name);$('editor-'+name+'-mode').onkeydown=e=>{const names=['crop','image','direction'];if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const index=names.indexOf(name),next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;setMode(names[next]);$('editor-'+names[next]+'-mode').focus();}};}
    $('editor-undo').onclick=()=>travel(-1);$('editor-redo').onclick=()=>travel(1);
    $('editor-reset-crop').onclick=()=>mutate(()=>{session.draft.crop=fullCrop();});
    $('editor-reset-page').onclick=()=>mutate(()=>{session.draft=originalState();session.selectedId=null;});
    for(const [id,action] of [['editor-rotate-left','left'],['editor-rotate-right','right'],['editor-flip-horizontal','horizontal'],['editor-flip-vertical','vertical'],['editor-reset-direction','reset']])$(id).onclick=()=>rotate(action);
    $('editor-add-image').onclick=()=>$('editor-image-file').click();$('editor-image-file').onchange=e=>{const files=Array.from(e.target.files);e.target.value='';addImages(files);};$('editor-delete-image').onclick=removeSelected;
    for(const k of ['x','y','w','h'])$('crop-'+k).oninput=()=>{if(!session||session.working)return;const values=Object.fromEntries(['x','y','w','h'].map(k=>[k,$('crop-'+k).valueAsNumber/100]));if(Object.values(values).every(Number.isFinite)){session.draft.crop=normalizeCrop(values);paint();}};
    for(const k of ['x','y','w'])$('image-'+k).oninput=()=>{const im=selected();if(!im||session.working)return;const value=$('image-'+k).valueAsNumber/100;if(!Number.isFinite(value))return;if(k==='w'){const ratio=im.h/im.w,max=Math.min(1-im.x,(1-im.y)/ratio);im.w=clamp(value,Math.min(.01,max),max);im.h=im.w*ratio;}else im[k]=clamp(value,0,1-im[k==='x'?'w':'h']);paint();};
    for(const id of ['crop-x','crop-y','crop-w','crop-h','image-x','image-y','image-w']){$(id).onchange=()=>{checkpoint();updateHistoryControls();};$(id).onblur=()=>{checkpoint();paint();};}
    $('editor-save').onclick=()=>{if(!session||session.working)return;session.draft.crop=normalizeCrop(session.draft.crop);checkpoint();stashCurrent();
      if(session.fileMode&&options.onFileCommit)options.onFileCommit(session.entries.map(e=>({...e,draft:cloneState(e.draft)})));
      else options.onCommit(session.item,cloneState(session.draft),false,session.history);close(true);
    };
    $('editor-page-up').onclick=()=>movePage(-1);$('editor-page-down').onclick=()=>movePage(1);$('editor-apply-crop-all').onclick=copyCropToPages;
    for(const [id,name,label]of [['editor-undo','undo','撤销当前页编辑（⌘/Ctrl+Z）'],['editor-redo','redo','重做当前页编辑（⌘/Ctrl+Shift+Z）'],['editor-reset-page','reset','恢复当前页原始状态'],['editor-rotate-left','rotateLeft','左转 90°'],['editor-rotate-right','rotateRight','右转 90°'],['editor-flip-horizontal','flipH','水平翻转'],['editor-flip-vertical','flipV','垂直翻转'],['editor-reset-direction','reset','恢复方向'],['editor-reset-crop','reset','恢复整图'],['editor-add-image','plus','添加贴图'],['editor-delete-image','trash','删除所选贴图'],['editor-page-up','up','当前页前移'],['editor-page-down','down','当前页后移'],['editor-apply-crop-all','stack','将裁剪应用到全部页面（各页可撤销）']])UIIcons.set($(id),name,label);
    for(const [name,glyph,label]of [['crop','crop','裁剪'],['image','image','贴图'],['direction','direction','方向']]){const el=$('editor-'+name+'-mode');el.replaceChildren(UIIcons.svg(glyph));el.append(Object.assign(document.createElement('span'),{textContent:label}));}

    $('editor-stage').onpointerdown=pointerDown;$('editor-stage').onpointermove=pointerMove;
    $('editor-stage').onpointerup=()=>{gesture=null;checkpoint();updateHistoryControls();};$('editor-stage').onpointercancel=()=>{gesture=null;checkpoint();updateHistoryControls();};
    $('page-editor').onkeydown=e=>{
      if(!session||session.working)return;
      if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();travel(e.key.toLowerCase()==='y'||e.shiftKey?1:-1);return;}
      if(e.target.closest('input'))return;
      if((e.key==='Delete'||e.key==='Backspace')&&selected()){e.preventDefault();removeSelected();}
    };
  }
  return {crop,normalizeCrop,dimensions,orientation,changed,render,pdfGeometry,snapshot,overlayUrls,applyCrop,init,open};
})();
