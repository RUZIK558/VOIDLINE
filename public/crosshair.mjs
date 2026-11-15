export function paintCrosshair(el,s){
 if(!el)return;
 const size=s.crossSize,gap=s.crossGap,t=s.crossThickness;
 el.style.opacity=s.crossOpacity;el.style.filter=s.crossOutline?'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)':'none';
 el.style.setProperty('--gap',gap+'px');
 [...el.querySelectorAll('i')].forEach((n,i)=>{n.style.position='absolute';n.style.display='block';n.style.background=s.crossColor;n.style.width=(i<2?t:size)+'px';n.style.height=(i<2?size:t)+'px';n.style.left=i<2?-t/2+'px':i===2?`calc(-${size}px - var(--gap))`:'var(--gap)';n.style.top=i>=2?-t/2+'px':i===0?`calc(-${size}px - var(--gap))`:'var(--gap)';});
 const dot=el.querySelector('b');if(dot){dot.hidden=!s.crossDot;Object.assign(dot.style,{position:'absolute',width:t+'px',height:t+'px',left:-t/2+'px',top:-t/2+'px',background:s.crossColor});}
}
