param([ValidateSet('info','apply')][string]$Command='info',[int]$Width=0,[int]$Height=0,[int]$Hz=0)
$ErrorActionPreference='Stop'
Add-Type @'
using System; using System.Runtime.InteropServices;
public class VLDisplay {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct DEVMODE {
 [MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)]public string dmDeviceName;
 public ushort dmSpecVersion,dmDriverVersion,dmSize,dmDriverExtra; public uint dmFields;
 public int dmPositionX,dmPositionY;public uint dmDisplayOrientation,dmDisplayFixedOutput;
 public short dmColor,dmDuplex,dmYResolution,dmTTOption,dmCollate;
 [MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)]public string dmFormName;
 public ushort dmLogPixels; public uint dmBitsPerPel,dmPelsWidth,dmPelsHeight,dmDisplayFlags,dmDisplayFrequency,dmICMMethod,dmICMIntent,dmMediaType,dmDitherType,dmReserved1,dmReserved2,dmPanningWidth,dmPanningHeight;
 }
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern bool EnumDisplaySettings(string name,int mode,ref DEVMODE dm);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int ChangeDisplaySettingsEx(string name,ref DEVMODE dm,IntPtr hwnd,uint flags,IntPtr data);
 public static DEVMODE Mode(int index){var m=new DEVMODE();m.dmSize=(ushort)Marshal.SizeOf(typeof(DEVMODE));if(!EnumDisplaySettings(null,index,ref m))throw new Exception("Display mode unavailable");return m;}
 public static int Apply(int w,int h,int hz){var m=Mode(-1);m.dmPelsWidth=(uint)w;m.dmPelsHeight=(uint)h;m.dmDisplayFrequency=(uint)hz;m.dmFields=0x00580000;int r=ChangeDisplaySettingsEx(null,ref m,IntPtr.Zero,2,IntPtr.Zero);if(r!=0)return r;return ChangeDisplaySettingsEx(null,ref m,IntPtr.Zero,0,IntPtr.Zero);}
}
'@
if($Command -eq 'apply') { $r=[VLDisplay]::Apply($Width,$Height,$Hz); if($r -ne 0){throw "Windows rejected display mode: $r"}; '{"ok":true}'; exit }
$current=[VLDisplay]::Mode(-1);$modes=@();for($i=0;$i -lt 4096;$i++){try{$m=[VLDisplay]::Mode($i)}catch{break};if($m.dmBitsPerPel -eq 32 -and $m.dmDisplayFrequency -gt 1 -and $m.dmPelsWidth -ge 800){$modes+=@{width=[int]$m.dmPelsWidth;height=[int]$m.dmPelsHeight;hz=[int]$m.dmDisplayFrequency}}}
@{supported=$true;backend='Windows / основной монитор';current=@{width=[int]$current.dmPelsWidth;height=[int]$current.dmPelsHeight;hz=[int]$current.dmDisplayFrequency};modes=$modes} | ConvertTo-Json -Depth 4 -Compress
