// Relative XInput2 motion while the specified VOIDLINE window owns keyboard focus.
// No pointer warping, injection, keyboard hooks, network access or background capture.
#include <X11/Xlib.h>
#include <X11/extensions/XInput2.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <errno.h>
static int focused(Display *d, Window target) {
  Window w; int revert; XGetInputFocus(d,&w,&revert);
  for(int i=0;i<32 && w!=None && w!=PointerRoot;i++) {
    if(w==target)return 1;
    Window root,parent,*children=NULL;unsigned int count=0;
    if(!XQueryTree(d,w,&root,&parent,&children,&count))return 0;
    if(children)XFree(children);
    if(w==root||parent==w)break;
    w=parent;
  }
  return 0;
}
int main(int argc,char **argv) {
  if(argc!=2)return 2;
  char *end=NULL;errno=0;unsigned long id=strtoul(argv[1],&end,16);
  if(errno||!id||!end||*end)return 2;
  Display *d=XOpenDisplay(NULL);if(!d){fprintf(stderr,"XOpenDisplay failed\n");return 3;}
  int opcode,event,error,major=2,minor=2;
  if(!XQueryExtension(d,"XInputExtension",&opcode,&event,&error)||XIQueryVersion(d,&major,&minor)!=Success){XCloseDisplay(d);return 4;}
  unsigned char bits[XIMaskLen(XI_RawMotion)]={0};XISetMask(bits,XI_RawMotion);
  XIEventMask mask={XIAllMasterDevices,sizeof(bits),bits};
  if(XISelectEvents(d,DefaultRootWindow(d),&mask,1)!=Success){XCloseDisplay(d);return 5;}
  XSync(d,False);setvbuf(stdout,NULL,_IOLBF,0);puts("READY");
  for(;;){
    XEvent e;XNextEvent(d,&e);
    if(e.type!=GenericEvent||e.xcookie.extension!=opcode||!XGetEventData(d,&e.xcookie))continue;
    if(e.xcookie.evtype==XI_RawMotion && focused(d,(Window)id)){
      XIRawEvent *r=e.xcookie.data;double dx=0,dy=0,*v=r->raw_values;
      for(int axis=0;axis<r->valuators.mask_len*8;axis++)if(XIMaskIsSet(r->valuators.mask,axis)){
        double value=*v++;if(axis==0)dx=value;else if(axis==1)dy=value;
      }
      if(isfinite(dx)&&isfinite(dy)&&(dx!=0||dy!=0))printf("%.8g %.8g\n",dx,dy);
    }
    XFreeEventData(d,&e.xcookie);
  }
}
