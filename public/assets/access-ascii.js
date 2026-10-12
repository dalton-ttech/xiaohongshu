(() => {
  const pre = document.getElementById('asciiArt');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('motionToggle');
  if (!pre || !toggle) return;
  let paused = reduced.matches, phase = .35, last = 0;
  const columns = 90, rows = 38, points = [];
  const normalize = v => { const d = Math.hypot(...v); return v.map(n => n / d); };
  const curve = t => [(2 + .65 * Math.cos(3*t))*Math.cos(2*t), (2 + .65 * Math.cos(3*t))*Math.sin(2*t), .85*Math.sin(3*t)];
  for (let t=0; t<Math.PI*2; t+=.018) {
    const c=curve(t), next=curve(t+.005), tangent=normalize(next.map((n,i)=>n-c[i]));
    const n=normalize([-tangent[1],tangent[0],0]);
    const b=[tangent[1]*n[2]-tangent[2]*n[1],tangent[2]*n[0]-tangent[0]*n[2],tangent[0]*n[1]-tangent[1]*n[0]];
    for (let a=0; a<Math.PI*2; a+=.21) {
      const normal=n.map((v,i)=>v*Math.cos(a)+b[i]*Math.sin(a));
      points.push({p:c.map((v,i)=>v+.32*normal[i]),n:normal});
    }
  }
  function draw(angle) {
    const cells=new Array(columns*rows).fill(' '), depth=new Float32Array(columns*rows).fill(Infinity);
    const cy=Math.cos(angle),sy=Math.sin(angle),cx=Math.cos(.75),sx=Math.sin(.75);
    const rotate=([x,y,z])=>[x*cy+z*sy,y*cx-(z*cy-x*sy)*sx,y*sx+(z*cy-x*sy)*cx];
    for (const point of points) {
      const [x,y,z]=rotate(point.p),[nx,ny,nz]=rotate(point.n),perspective=8/(8+z);
      const px=Math.round(columns/2+x*12.8*perspective),py=Math.round(rows/2+y*5.9*perspective);
      if(px<0||px>=columns||py<0||py>=rows)continue;
      const index=py*columns+px;
      if(z>=depth[index])continue;
      depth[index]=z;
      const light=Math.max(0,Math.min(1,(-nx*.3-ny*.4-nz*.8+1)/2));
      cells[index]='.:-=+*#%@'[Math.min(8,Math.floor(light*9))];
    }
    let text='';for(let row=0;row<rows;row++)text+=cells.slice(row*columns,(row+1)*columns).join('')+(row===rows-1?'':'\n');
    pre.textContent=text;
  }
  function frame(time) {
    if(time-last>66){
      if(!paused&&!document.body.classList.contains('is-arriving')&&!document.hidden){phase+=.005;draw(phase);}
      last=time;
    }
    requestAnimationFrame(frame);
  }
  function syncToggle(){toggle.textContent=paused?'[ 播放 ]':'[ 暂停 ]';toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'播放字符动画':'暂停字符动画');}
  toggle.addEventListener('click',()=>{paused=!paused;syncToggle();});
  reduced.addEventListener('change',()=>{paused=reduced.matches;syncToggle();});
  draw(phase);syncToggle();requestAnimationFrame(frame);
  const fitArt=()=>{const box=pre.parentElement;const scale=Math.min(1,(box.clientWidth-12)/pre.offsetWidth,(box.clientHeight-12)/pre.offsetHeight);pre.style.transform='scale('+scale+')';};
  new ResizeObserver(fitArt).observe(pre.parentElement);document.fonts.ready.then(fitArt);
})();
