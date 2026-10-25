//! Bounded host->guest encoder/queue; ASCII JSON, one writer, partial writes.
use serde::Serialize;
use serde_json::ser::{Formatter, Serializer};
use std::{collections::VecDeque, io::{self, Write}};
use crate::MAX;

#[derive(Serialize)]
pub struct Provider<'a> {pub name:&'a str,pub fns:&'a [&'a str]}
#[derive(Serialize)]
#[serde(tag="t",rename_all="lowercase")]
pub enum Outbound<'a> {
    Code{source:&'a str,providers:&'a [Provider<'a>]},
    Result{id:u32,value:&'a serde_json::Value},
    Err{id:u32,code:&'a str,message:&'a str},
}
struct Ascii;
impl Formatter for Ascii {
    fn write_string_fragment<W: ?Sized+Write>(&mut self,w:&mut W,s:&str)->io::Result<()> {
        // Serializer has already separated JSON escapes from ordinary fragments.
        for c in s.chars() {
            if (c as u32)<127 {w.write_all(&[c as u8])?}
            else {for u in c.encode_utf16(&mut [0;2]) {write!(w,"\\u{u:04x}")?}}
        } Ok(())
    }
}
struct Limited(Vec<u8>);
impl Write for Limited {
    fn write(&mut self,b:&[u8])->io::Result<usize>{
        if self.0.len()+b.len()>MAX{return Err(io::Error::other("frame cap"))}
        self.0.extend_from_slice(b);Ok(b.len())
    }
    fn flush(&mut self)->io::Result<()>{Ok(())}
}
pub fn encode(m:&Outbound)->Result<Vec<u8>,String>{
    if let Outbound::Code{source,..}=m {if source.len()>262144{return Err("code cap".into())}}
    if let Outbound::Result{value,..}=m {check_value(value,1,&mut 0)?}
    if let Outbound::Err{code,message,..}=m {if code.len()>64||message.len()>1024{return Err("error cap".into())}}
    let mut w=Limited(Vec::new());
    m.serialize(&mut Serializer::with_formatter(&mut w,Ascii)).map_err(|e|e.to_string())?;
    w.0.push(b'\n');Ok(w.0)
}
fn check_value(v:&serde_json::Value,depth:usize,nodes:&mut usize)->Result<(),String>{
    *nodes+=1;if depth>31||*nodes>16384{return Err("value complexity".into())}
    match v {
        serde_json::Value::Number(n) if n.as_f64().is_none_or(|x|!x.is_finite()||x.abs()>crate::SAFE as f64)=>return Err("number range".into()),
        serde_json::Value::Array(a)=>for x in a {check_value(x,depth+1,nodes)?},
        serde_json::Value::Object(m)=>for x in m.values(){check_value(x,depth+1,nodes)?},
        _=>{}
    } Ok(())
}
#[derive(Default)]
pub struct Queue {frames:VecDeque<Vec<u8>>,offset:usize,bytes:usize,total:usize}
impl Queue {
    pub fn push(&mut self,frame:Vec<u8>)->Result<(),Vec<u8>>{
        if frame.len()>MAX+1||self.bytes+frame.len()>2*(MAX+1)||self.total+frame.len()>16*MAX{return Err(frame)}
        self.bytes+=frame.len();self.total+=frame.len();self.frames.push_back(frame);Ok(())
    }
    pub fn drain(&mut self,w:&mut impl Write)->io::Result<()>{
        while let Some(frame)=self.frames.front(){
            match w.write(&frame[self.offset..]) {
                Ok(0)=>return Err(io::ErrorKind::WriteZero.into()),
                Ok(n)=>{self.offset+=n;self.bytes-=n;
                    if self.offset==frame.len(){self.frames.pop_front();self.offset=0;}},
                Err(e) if e.kind()==io::ErrorKind::WouldBlock=>return Ok(()),
                Err(e) if e.kind()==io::ErrorKind::Interrupted=>continue,
                Err(e)=>return Err(e),
            }
        } Ok(())
    }
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn ascii_cap_and_partial_writes(){
        let v=serde_json::json!("日本語😀\n");
        let b=encode(&Outbound::Result{id:1,value:&v}).unwrap();
        assert!(b.is_ascii());assert_eq!(serde_json::from_slice::<serde_json::Value>(&b).unwrap()["value"],v);
        let v=serde_json::json!("x".repeat(MAX));assert!(encode(&Outbound::Result{id:1,value:&v}).is_err());
        let v=serde_json::json!(9007199254740993u64);assert!(encode(&Outbound::Result{id:1,value:&v}).is_err());
        let mut v=serde_json::Value::Null;for _ in 0..32 {v=serde_json::json!([v])}
        assert!(encode(&Outbound::Result{id:1,value:&v}).is_err());
        let mut q=Queue::default();q.push(b.clone()).unwrap();
        struct Short(Vec<u8>);impl Write for Short {
            fn write(&mut self,b:&[u8])->io::Result<usize>{let n=b.len().min(7);self.0.extend_from_slice(&b[..n]);Ok(n)}
            fn flush(&mut self)->io::Result<()>{Ok(())}
        }
        let mut w=Short(Vec::new());q.drain(&mut w).unwrap();assert_eq!(w.0,b);assert_eq!(q.bytes,0);
        q.push(vec![b'x';MAX+1]).unwrap();q.push(vec![b'x';MAX+1]).unwrap();assert!(q.push(vec![b'x']).is_err());
    }
}
