using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Management;
using System.Web.Script.Serialization;
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.ComponentModel;
public static class MoonPerfJob {
 [StructLayout(LayoutKind.Sequential)] public struct BASIC { public long UserTime,JobTime;public uint Flags;public UIntPtr MinWS,MaxWS;public uint Processes;public UIntPtr Affinity;public uint Priority,Class; }
 [StructLayout(LayoutKind.Sequential)] public struct IO {public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes;}
 [StructLayout(LayoutKind.Sequential)] public struct EXT {public BASIC Basic;public IO Io;public UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct START {public uint Size;public string Reserved,Desktop,Title;public uint X,Y,XSize,YSize,XChars,YChars,Fill,Flags;public short Show,Reserved2;public IntPtr ReservedPtr,In,Out,Err;}
 [StructLayout(LayoutKind.Sequential)] public struct PI {public IntPtr Process,Thread;public uint Pid,Tid;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int type,ref EXT data,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int type,IntPtr data,uint size,IntPtr needed);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref START si,out PI pi);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint exit);
 public static IntPtr Launch(string exe,string args) {
  IntPtr job=CreateJobObject(IntPtr.Zero,null);
  if(job==IntPtr.Zero)throw new Win32Exception();
  EXT e=new EXT();e.Basic.Flags=0x200|0x2000|0x10;e.Basic.Affinity=new UIntPtr(1);e.JobMemory=new UIntPtr(1073741824);
  if(!SetInformationJobObject(job,9,ref e,(uint)Marshal.SizeOf(e))){CloseHandle(job);throw new Win32Exception();}
  START si=new START();si.Size=(uint)Marshal.SizeOf(si);PI pi;
  if(!CreateProcess(exe,new StringBuilder("\""+exe+"\" "+args),IntPtr.Zero,IntPtr.Zero,false,4,IntPtr.Zero,null,ref si,out pi)){CloseHandle(job);throw new Win32Exception();}
  if(!AssignProcessToJobObject(job,pi.Process)){TerminateProcess(pi.Process,1);CloseHandle(pi.Thread);CloseHandle(pi.Process);CloseHandle(job);throw new Win32Exception();}
  ResumeThread(pi.Thread);CloseHandle(pi.Thread);CloseHandle(pi.Process);return job;
 }
 public static ulong[] Stats(IntPtr job) {
  int n=Marshal.SizeOf(typeof(EXT));IntPtr p=Marshal.AllocHGlobal(n);
  try {if(!QueryInformationJobObject(job,9,p,(uint)n,IntPtr.Zero))throw new Win32Exception();EXT e=(EXT)Marshal.PtrToStructure(p,typeof(EXT));return new ulong[]{e.JobMemory.ToUInt64(),e.PeakJobMemory.ToUInt64()};}finally{Marshal.FreeHGlobal(p);}
 }
 public static int[] Pids(IntPtr job) {
  IntPtr p=Marshal.AllocHGlobal(8192);try{if(!QueryInformationJobObject(job,3,p,8192,IntPtr.Zero))throw new Win32Exception();int count=Marshal.ReadInt32(p,4);int[] ids=new int[count];for(int i=0;i<count;i++)ids[i]=(int)Marshal.ReadIntPtr(p,8+i*IntPtr.Size);return ids;}finally{Marshal.FreeHGlobal(p);}
 }
}
public class MoonPerfLauncher {
 static void Main(string[] args){
  if(args.Length<2||!System.Text.RegularExpressions.Regex.IsMatch(args[0],@"^http://127\.0\.0\.1:\d+/"))throw new Exception("Local test URL and output file required");
  string output=args[1],profile=Path.Combine(Path.GetTempPath(),"moon-perf-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(profile);
  string browser="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  string flags="--enable-logging --log-file="+output+".chrome.log --user-data-dir=\""+profile+"\" --no-first-run --no-default-browser-check --window-size=960,720 --force-device-scale-factor=1 --disk-cache-size=16777216 --media-cache-size=8388608 --js-flags=\"--max-old-space-size=256\" --app=\""+args[0]+"\"";
  if(args.Length>2&&args[2]=="logic"){browser="C:\\Program Files\\nodejs\\node.exe";flags="--max-old-space-size=128 --max-semi-space-size=8 --expose-gc \""+Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"MoonLogicStress.cjs")+"\" \""+args[0]+"\" \""+output+".logic.json\"";}
  IntPtr job=MoonPerfJob.Launch(browser,flags);var rows=new List<object>();var json=new JavaScriptSerializer();bool gpuAvailable=true;
  try {for(int t=0;t<180;t+=2){
   int[] ids=MoonPerfJob.Pids(job);if(ids.Length==0)break;ulong[] stats=MoonPerfJob.Stats(job);
   long priv=0,working=0;double cpu=0;foreach(int pid in ids)try{var p=Process.GetProcessById(pid);priv+=p.PrivateMemorySize64;working+=p.WorkingSet64;cpu+=p.TotalProcessorTime.TotalSeconds;}catch{}
   object dedicated=null,shared=null,util=null;
   if(gpuAvailable)try{
    ulong d=0,s=0;double u=0;
    using(var search=new ManagementObjectSearcher("SELECT * FROM Win32_PerfFormattedData_GPUPerformanceCounters_GPUProcessMemory"))foreach(ManagementObject o in search.Get()){
     var m=System.Text.RegularExpressions.Regex.Match(Convert.ToString(o["Name"]),@"pid_(\d+)_");
     if(m.Success&&ids.Contains(int.Parse(m.Groups[1].Value))){d+=Convert.ToUInt64(o["DedicatedUsage"]);s+=Convert.ToUInt64(o["SharedUsage"]);}}
    using(var search=new ManagementObjectSearcher("SELECT * FROM Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine"))foreach(ManagementObject o in search.Get()){
     string name=Convert.ToString(o["Name"]);var m=System.Text.RegularExpressions.Regex.Match(name,@"pid_(\d+)_");
     if(m.Success&&ids.Contains(int.Parse(m.Groups[1].Value))&&name.Contains("engtype_3D"))u+=Convert.ToDouble(o["UtilizationPercentage"]);}
    dedicated=d;shared=s;util=u;
   }catch{gpuAvailable=false;}
   rows.Add(new{seconds=t,limitBytes=stats[0],peakJobCommitBytes=stats[1],processes=ids.Length,privateBytes=priv,workingSetBytes=working,cpuSeconds=cpu,gpuDedicatedBytes=dedicated,gpuSharedBytes=shared,gpu3dPercent=util});
   File.WriteAllText(output,json.Serialize(new{kind="Windows job committed-memory cap; not full OS RAM",oneCpuCore=true,profile=profile,gpuCountersAvailable=gpuAvailable,samples=rows.ToArray()}));
   if(File.Exists(output+".stop"))break;Thread.Sleep(2000);
  }var final=MoonPerfJob.Stats(job);File.WriteAllText(output,json.Serialize(new{kind="Windows job committed-memory cap; not full OS RAM",oneCpuCore=true,limitBytes=final[0],peakJobCommitBytes=final[1],gpuCountersAvailable=gpuAvailable,samples=rows.ToArray()}));}finally{MoonPerfJob.CloseHandle(job);}
 }
}