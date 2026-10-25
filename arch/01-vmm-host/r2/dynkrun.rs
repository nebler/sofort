// Benchmark-only adapter to the supplied generated C ABI; product uses native Rust.
use std::{ffi::c_void, os::fd::{AsRawFd, BorrowedFd}};
type H = *mut c_void;
type E = Result<(), Box<dyn std::error::Error>>;
#[repr(C)] struct S { data: *const u8, len: usize }
fn s(v: &str) -> S { S {data:v.as_ptr(),len:v.len()} }
fn check(err:H)->E { if err.is_null() {Ok(())} else {Err("libkrun C API error".into())} }
#[link(name="krun")]
unsafe extern "C" {
 fn krun_console_device_builder()->H;
 fn krun_console_builder_add_inout_port(h:H,n:S,i:i32,o:i32,r:*mut u32,e:*mut H)->u64;
 fn krun_console_builder_build(h:H,e:*mut H)->H;
 fn krun_mmio_device_manager_new()->H;
 fn krun_mmio_device_manager_add(h:H,d:H);
 fn krun_payload_load_external(p:S,f:u32,i:S,c:S,e:*mut H)->H;
 fn krun_vmm_builder_new()->H;
 fn krun_vmm_builder_vcpus(h:*mut H,n:u8,e:*mut H)->u64;
 fn krun_vmm_builder_ram_mib(h:*mut H,n:u32,e:*mut H)->u64;
 fn krun_vmm_builder_payload(h:*mut H,p:H);
 fn krun_vmm_builder_devices(h:*mut H,d:H);
 fn krun_vmm_builder_nested_virt(h:*mut H,v:bool);
 fn krun_vmm_builder_shutdown_support(h:*mut H,v:bool);
 fn krun_vmm_builder_build(h:*mut H,e:*mut H)->H;
 fn krun_vmm_run(h:H);
}
pub struct ConsoleDevice(H);
pub struct ConsoleBuilder(H);
impl ConsoleDevice {pub fn builder()->ConsoleBuilder {ConsoleBuilder(unsafe {krun_console_device_builder()})}}
impl ConsoleBuilder {
 pub fn add_inout_port(&mut self,n:&str,i:Option<BorrowedFd<'_>>,o:Option<BorrowedFd<'_>>)->Result<u32,Box<dyn std::error::Error>> {
 let mut e=std::ptr::null_mut();let mut r=0;
 unsafe {krun_console_builder_add_inout_port(self.0,s(n),i.unwrap().as_raw_fd(),o.unwrap().as_raw_fd(),&mut r,&mut e);}
 check(e)?;Ok(r)
 }
 pub fn build(self)->Result<ConsoleDevice,Box<dyn std::error::Error>> {let mut e=std::ptr::null_mut();let h=unsafe {krun_console_builder_build(self.0,&mut e)};check(e)?;Ok(ConsoleDevice(h))}
}
pub struct MmioDeviceManager(H);
impl MmioDeviceManager {
 pub fn new()->Self {Self(unsafe {krun_mmio_device_manager_new()})}
 pub fn add(&mut self,d:ConsoleDevice){unsafe {krun_mmio_device_manager_add(self.0,d.0)}}
}
pub enum KernelFormat {Raw}
pub struct Payload(H);
impl Payload {
 pub fn load_external(p:&str,_f:KernelFormat,_i:Option<&str>,c:&str)->Result<Self,Box<dyn std::error::Error>> {
 let mut e=std::ptr::null_mut();let h=unsafe {krun_payload_load_external(s(p),1,S {data:std::ptr::null(),len:0},s(c),&mut e)};check(e)?;Ok(Self(h))
 }
}
pub struct VmmBuilder(H);pub struct Vmm(H);
impl VmmBuilder {
 pub fn new()->Self {Self(unsafe {krun_vmm_builder_new()})}
 pub fn vcpus(mut self,n:u8)->Result<Self,Box<dyn std::error::Error>> {let mut e=std::ptr::null_mut();unsafe {krun_vmm_builder_vcpus(&mut self.0,n,&mut e);}check(e)?;Ok(self)}
 pub fn ram_mib(mut self,n:u32)->Result<Self,Box<dyn std::error::Error>> {let mut e=std::ptr::null_mut();unsafe {krun_vmm_builder_ram_mib(&mut self.0,n,&mut e);}check(e)?;Ok(self)}
 pub fn payload(mut self,p:Payload)->Self {unsafe {krun_vmm_builder_payload(&mut self.0,p.0)};self}
 pub fn devices(mut self,d:MmioDeviceManager)->Self {unsafe {krun_vmm_builder_devices(&mut self.0,d.0)};self}
 pub fn nested_virt(mut self,v:bool)->Self {unsafe {krun_vmm_builder_nested_virt(&mut self.0,v)};self}
 pub fn shutdown_support(mut self,v:bool)->Self {unsafe {krun_vmm_builder_shutdown_support(&mut self.0,v)};self}
 pub fn build(mut self)->Result<Vmm,Box<dyn std::error::Error>> {let mut e=std::ptr::null_mut();let h=unsafe {krun_vmm_builder_build(&mut self.0,&mut e)};check(e)?;Ok(Vmm(h))}
}
impl Vmm {pub fn run(self){unsafe {krun_vmm_run(self.0)}}}
