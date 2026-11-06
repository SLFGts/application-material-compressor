'use strict';
window.UIIcons=(()=>{
  const paths={
    up:'M12 19V5m-5 5 5-5 5 5',down:'M12 5v14m-5-5 5 5 5-5',close:'m6 6 12 12M6 18 18 6',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    download:'M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4',arrow:'M5 12h14m-5-5 5 5-5 5',check:'m5 12 4 4L19 6',edit:'m14 5 5 5M4 20l5-1L20 8a2.1 2.1 0 0 0-4-4L5 15z',
    undo:'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12',redo:'m15 5 5 5-5 5M20 10h-9a6 6 0 0 0 0 12',reset:'M4 10a8 8 0 1 1 0 5M4 4v6h6',
    rotateLeft:'M4 10a8 8 0 1 1 1 8M4 4v6h6M10 9h6v6h-6z',rotateRight:'M20 10a8 8 0 1 0-1 8M20 4v6h-6M8 9h6v6H8z',
    flipH:'M12 3v2m0 3v2m0 4v2m0 3v2M9 5 3 12l6 7zm6 0 6 7-6 7z',flipV:'M3 12h2m3 0h2m4 0h2m3 0h2M5 9l7-6 7 6zm0 6 7 6 7-6z',
    crop:'M6 3v15h15M3 6h15v15M3 21 21 3',image:'M3 4h18v16H3zM3 16l5-5 4 4 4-6 5 7M7 8h.01',direction:'M12 3v18M3 12h18m-9-9-3 3m3-3 3 3m-3 15-3-3m3 3 3-3M3 12l3-3m-3 3 3 3m15-3-3-3m3 3-3 3',
    plus:'M12 5v14M5 12h14',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',stack:'M4 3h12v14H4zM8 21h12V7',
    left:'m15 5-7 7 7 7',right:'m9 5 7 7-7 7',file:'M14 3H5v18h14V8zM14 3v5h5M8 13h8M8 17h6',
    selectAll:'M3 3h18v18H3zM7 12l3 3 7-7',selectNone:'M3 3h18v18H3z',help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20'
  };
  function svg(name){const el=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [k,v]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.65','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))el.setAttribute(k,v);const path=document.createElementNS(el.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.file);el.append(path);return el;}
  function set(el,name,label){if(!el)return;el.replaceChildren(svg(name));el.classList.add('icon-button');el.setAttribute('aria-label',label);el.title=label;if(el.tagName==='BUTTON')el.type='button';}
  return {svg,set};
})();
