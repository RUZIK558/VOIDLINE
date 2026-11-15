export function aimDelta(yaw,pitch,dx,dy,sensitivity=1,invertY=false){
 const tau=Math.PI*2,limit=Math.PI/2-.01;
 return {yaw:((yaw-dx*.002*sensitivity)%tau+tau)%tau,pitch:Math.max(-limit,Math.min(limit,pitch-dy*.002*sensitivity*(invertY?-1:1)))};
}
