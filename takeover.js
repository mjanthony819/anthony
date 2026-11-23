(()=>{
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let hero,content,items,target=0,cur=0,raf=0,rvT=[];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function read(){
  const vh=innerHeight;
  target=clamp(scrollY/vh,0,1);
  // content reveal progress per item, based on viewport position
  rvT=items.map(el=>{const r=el.getBoundingClientRect();return clamp((vh*0.95-r.top)/(vh*0.35),0,1)});
}
function paint(){
  raf=0;
  cur+=(target-cur)*0.18; if(Math.abs(target-cur)<0.001)cur=target;
  const p=cur;
  if(!reduce.matches){
    hero.style.transform='scale('+(1-0.1*p).toFixed(4)+')';
    hero.style.opacity=(1-0.85*p).toFixed(3);
    hero.style.filter=p>0.01?'blur('+(p*5).toFixed(2)+'px)':'none';
    items.forEach((el,i)=>el.style.setProperty('--tk-rv',rvT[i].toFixed(3)));
  }
  content.style.setProperty('--tk-in',clamp((p-0.7)/0.3,0,1).toFixed(3));
  if(cur!==target)raf=requestAnimationFrame(paint);
}
function onScroll(){read();if(!raf)raf=requestAnimationFrame(paint)}
function init(){
  hero=document.querySelector('.as-hero');content=document.querySelector('.as-content');
  if(!hero||!content)return false;
  items=[...content.children];items.forEach(e=>e.classList.add('tk-rv'));
  addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);
  new MutationObserver(()=>{const n=[...content.children].filter(e=>!e.classList.contains('tk-rv'));if(n.length){n.forEach(e=>e.classList.add('tk-rv'));items=[...content.children];onScroll()}}).observe(content,{childList:true});
  cur=clamp(scrollY/innerHeight,0,1);onScroll();return true;
}
let n=0;const t=setInterval(()=>{if(init()||++n>80)clearInterval(t)},150);
})();
