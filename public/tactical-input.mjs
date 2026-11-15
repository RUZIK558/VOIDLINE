// Hold/tap logic is independent of DOM and relative-mouse backend.
export function createTacticalHold({enabled,onTap,onOpen,onCommit,onClose,onSelect=()=>{},schedule=setTimeout,unschedule=clearTimeout,delay=240}){
 let pressed=false,open=false,timer=null,selected=null,x=0,y=0;
 function close(){if(timer!==null)unschedule(timer);timer=null;pressed=false;const wasOpen=open;open=false;selected=null;x=y=0;if(wasOpen)onClose();}
 return {
  get pressed(){return pressed;},get isOpen(){return open;},get selected(){return selected;},
  press(){if(pressed||!enabled())return false;pressed=true;timer=schedule(()=>{timer=null;if(!pressed||!enabled()){close();return;}open=true;onOpen();},delay);return true;},
  release(){if(!pressed)return false;const wasOpen=open,choice=selected,allow=enabled();close();if(allow){if(wasOpen){if(choice!==null)onCommit(choice);}else onTap();}return true;},
  choose(index){if(!open||!Number.isInteger(index)||index<0||index>5)return;selected=index;onSelect(index,x,y);},
  move(dx,dy,sector){if(!open)return false;x=Math.max(-205,Math.min(205,x+dx));y=Math.max(-155,Math.min(155,y+dy));selected=sector(x,y);onSelect(selected,x,y);return true;},
  cancel(){close();}
 };
}
