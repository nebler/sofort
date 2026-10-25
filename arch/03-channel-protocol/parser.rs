//! Bounded guest->host protocol decoder. Dispatcher supplies policy + deadlines.
#[allow(dead_code)]
mod outbound;
use serde::{de::{self, MapAccess, SeqAccess, Visitor}, Deserialize, Deserializer};
use serde_json::{Map, Number, Value};
use std::{collections::HashMap, fmt, io::{self, Read}, time::Instant};
pub const MAX: usize = 1_048_576;
const TOTAL: usize = 16 * MAX;
const SAFE: i64 = 9_007_199_254_740_991;

// Unlike Value's default deserializer, rejects duplicate keys at EVERY depth.
#[derive(Debug)]
struct Unique(Value);
impl<'de> Deserialize<'de> for Unique {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self,D::Error> {
        struct V;
        impl<'de> Visitor<'de> for V {
            type Value = Unique;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result { f.write_str("JSON") }
            fn visit_bool<E: de::Error>(self,v:bool)->Result<Unique,E>{Ok(Unique(Value::Bool(v)))}
            fn visit_unit<E: de::Error>(self)->Result<Unique,E>{Ok(Unique(Value::Null))}
            fn visit_i64<E: de::Error>(self,v:i64)->Result<Unique,E>{
                if !(-SAFE..=SAFE).contains(&v){return Err(E::custom("number range"))} Ok(Unique(v.into()))
            }
            fn visit_u64<E: de::Error>(self,v:u64)->Result<Unique,E>{
                if v>SAFE as u64{return Err(E::custom("number range"))} Ok(Unique(v.into()))
            }
            fn visit_f64<E: de::Error>(self,v:f64)->Result<Unique,E>{
                if v.abs()>SAFE as f64{return Err(E::custom("number range"))}
                Number::from_f64(v).map(|n|Unique(Value::Number(n))).ok_or_else(||E::custom("nonfinite"))
            }
            fn visit_str<E: de::Error>(self,v:&str)->Result<Unique,E>{Ok(Unique(v.into()))}
            fn visit_string<E: de::Error>(self,v:String)->Result<Unique,E>{Ok(Unique(v.into()))}
            fn visit_seq<A:SeqAccess<'de>>(self,mut a:A)->Result<Unique,A::Error>{
                let mut v=Vec::new(); while let Some(Unique(x))=a.next_element()? {v.push(x)}
                Ok(Unique(Value::Array(v)))
            }
            fn visit_map<A:MapAccess<'de>>(self,mut a:A)->Result<Unique,A::Error>{
                let mut m=Map::new(); while let Some(k)=a.next_key::<String>()? {
                    if m.contains_key(&k) {return Err(de::Error::custom("duplicate key"))}
                    let Unique(v)=a.next_value()?; m.insert(k,v);
                } Ok(Unique(Value::Object(m)))
            }
        }
        d.deserialize_any(V)
    }
}
#[derive(Debug,Deserialize)]
#[serde(tag="t",rename_all="lowercase",deny_unknown_fields)]
pub enum Message {
    Hello{v:u8}, Ready{},
    Call{id:u32,ns:String,#[serde(rename="fn")]function:String,args:Value},
    Log{level:Level,text:String}, Done{ok:bool,value:Value}, Fatal{code:String,message:String},
}
#[derive(Debug,Deserialize)]
#[serde(rename_all="lowercase")]
pub enum Level {Log,Info,Warn,Error,Debug}
fn bad<T>(s:&str)->Result<T,String>{Err(s.into())}
fn name(s:&str)->bool {
    let mut b=s.bytes(); s.len()<=64 && b.next().is_some_and(|c|c.is_ascii_alphabetic()||c==b'_'||c==b'$')
        && b.all(|c|c.is_ascii_alphanumeric()||c==b'_'||c==b'$')
}
pub fn parse(b:&[u8])->Result<Message,String>{
    if b.is_empty()||b.len()>MAX {return bad("frame size")}
    let(mut quoted,mut escaped,mut depth,mut tokens)=(false,false,0usize,0usize);
    for &c in b {
        if c>127 || c==b'\r' || c==b'\n' {return bad("ASCII/LF/CR")}
        if quoted {
            if escaped {escaped=false} else if c==b'\\' {escaped=true} else if c==b'"' {quoted=false}
        } else {match c {
            b'"'=>{quoted=true;tokens+=1},
            b'{'|b'['=>{depth+=1;tokens+=1;if depth>32{return bad("depth")}},
            b'}'|b']'=>{depth=depth.checked_sub(1).ok_or("depth")?},
            b','|b':'=>tokens+=1, _=>{}
        }}
        if tokens>32768 {return bad("structural budget")}
    }
    let Unique(v)=serde_json::from_slice::<Unique>(b).map_err(|e|e.to_string())?;
    serde_json::from_value(v).map_err(|e|e.to_string())
}
#[derive(Default)]
pub struct Decoder {line:Vec<u8>,bytes:usize,frames:usize,state:u8,next:u32,
    pending:HashMap<u32,usize>,pending_bytes:usize,logs:usize,log_count:usize,poisoned:bool}
impl Decoder {
    pub fn complete(&mut self,id:u32)->Result<(),String>{
        let n=self.pending.remove(&id).ok_or("unknown completion")?;
        self.pending_bytes-=n;Ok(())
    }
    fn accept(&mut self,m:&Message,wire_size:usize)->Result<(),String>{
        match m {
            Message::Hello{v:1} if self.state==0=>self.state=1,
            Message::Ready{} if self.state==1=>self.state=2,
            Message::Call{id,ns,function,..} if self.state==3=>{
                if *id!=self.next+1||*id>4096||self.pending.len()>=64||self.pending_bytes+wire_size>2*MAX||!name(ns)||!name(function){return bad("call budget/id/name")}
                self.next=*id;self.pending.insert(*id,wire_size);self.pending_bytes+=wire_size;
            },
            Message::Log{text,..} if self.state==3=>{
                self.log_count+=1;self.logs+=text.len();
                if text.len()>4096||self.logs>262144||self.log_count>1024{return bad("log budget")}
            },
            Message::Done{ok,..} if self.state==3 && (!ok || self.pending.is_empty())=>self.state=4,
            Message::Fatal{code,message} if self.state<4 && code.len()<=64 && message.len()<=1024=>self.state=4,
            _=>return bad("state violation")
        } Ok(())
    }
    // Call AFTER code frame is committed to the bounded host->guest writer queue.
    pub fn code_sent(&mut self)->Result<(),String>{
        if self.state!=2{return bad("not ready")} self.state=3;Ok(())
    }
    pub fn eof(&self)->Result<(),String>{
        if self.poisoned||!self.line.is_empty()||self.state!=4 {return bad("truncated/early EOF")} Ok(())
    }
    pub fn feed(&mut self,b:&[u8],mut emit:impl FnMut(Message))->Result<(),String>{
        if self.poisoned{return bad("poisoned")}
        self.poisoned=true; // Any error is terminal; never resynchronize hostile data.
        self.bytes=self.bytes.checked_add(b.len()).ok_or("overflow")?;
        if self.bytes>TOTAL{return bad("byte budget")}
        for &c in b {
            if c==b'\n' {
                self.frames+=1;if self.frames>8192{return bad("frame budget")}
                let m=parse(&self.line)?;self.accept(&m,self.line.len())?;self.line.clear();emit(m);
            } else {
                if self.line.len()==MAX||c>127||c==b'\r'{return bad("wire/size")}
                self.line.push(c);
            }
        }
        self.poisoned=false;Ok(())
    }
}
fn main(){
    if std::env::args().nth(1).as_deref()==Some("bench") {
        for n in [1024,102400,1048400] {
            let b=format!("{{\"t\":\"call\",\"id\":1,\"ns\":\"api\",\"fn\":\"echo\",\"args\":\"{}\"}}","x".repeat(n));
            let count=if n<2000{10000}else{1000};let t=Instant::now();
            for _ in 0..count {std::hint::black_box(parse(b.as_bytes()).unwrap());}
            println!("bytes={} iterations={} us_per_parse={:.3}",b.len(),count,t.elapsed().as_secs_f64()*1e6/count as f64);
        } return;
    }
    let mut d=Decoder::default();let mut b=[0u8;16384];
    loop {let n=io::stdin().read(&mut b).unwrap();if n==0{break}
        d.feed(&b[..n],|m|println!("{m:?}")).unwrap();}
    d.eof().unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    fn call(id:u32)->String {format!("{{\"t\":\"call\",\"id\":{id},\"ns\":\"api\",\"fn\":\"f\",\"args\":{{}}}}\n")}
    fn active()->Decoder{let mut d=Decoder::default();d.feed(b"{\"t\":\"hello\",\"v\":1}\n{\"t\":\"ready\"}\n",|_|{}).unwrap();d.code_sent().unwrap();d}
    #[test] fn hostile_schemas(){
        for s in [r#"{"t":"hello","v":1,"v":1}"#,r#"{"t":"ready","extra":1}"#,
            r#"{"t":"call","id":1,"ns":"x","fn":"x","args":{"x":1,"x":2}}"#,
            r#"{"t":"call","id":1.5,"ns":"x","fn":"x","args":null}"#,
            r#"{"t":"call","id":4294967296,"ns":"x","fn":"x","args":null}"#,
            r#"{"t":"hello","v":1}{}"#,r#"{"t":"wat"}"#,
            r#"{"t":"call","id":1,"ns":"x","fn":"x","args":9007199254740993}"#,
            r#"{"t":"call","id":1,"ns":"x","fn":"x","args":1e999}"#] {
            assert!(parse(s.as_bytes()).is_err(),"accepted {s}");
        }
    }
    #[test] fn depth_size_encoding(){
        assert!(parse(format!("{}0{}","[".repeat(33),"]".repeat(33)).as_bytes()).is_err());
        let mut d=Decoder::default();assert!(d.feed(&vec![b'x';MAX+1],|_|{}).is_err());
        assert!(d.feed(b"{}\n",|_|{}).is_err());
        assert!(parse(b"{\"t\":\"ready\"}\r").is_err());assert!(parse(&[255]).is_err());
        assert!(parse(b"{\"t\":\"log\",\"level\":\"info\",\"text\":\"\\ud800\"}").is_err());
    }
    #[test] fn fragmented_and_reordered(){
        let mut d=active();for c in call(1).bytes(){d.feed(&[c],|_|{}).unwrap()}
        d.feed(call(2).as_bytes(),|_|{}).unwrap();d.complete(2).unwrap();d.complete(1).unwrap();
        d.feed(b"{\"t\":\"done\",\"ok\":true,\"value\":null}\n",|_|{}).unwrap();d.eof().unwrap();
    }
    #[test] fn ids_window_state_eof(){
        let mut d=active();for i in 1..=64 {d.feed(call(i).as_bytes(),|_|{}).unwrap()}
        assert!(d.feed(call(65).as_bytes(),|_|{}).is_err());
        let mut d=active();d.feed(call(1).as_bytes(),|_|{}).unwrap();assert!(d.feed(call(1).as_bytes(),|_|{}).is_err());
        assert!(active().eof().is_err());assert!(active().feed(b"{\"t\":\"ready\"}\n",|_|{}).is_err());
        assert!(active().feed(b"{\"t\":\"log\",\"level\":\"info\",\"text\":\"x\"}\n",|_|{}).is_ok());
        let mut d=active();d.feed(call(1).as_bytes(),|_|{}).unwrap();
        assert!(d.feed(b"{\"t\":\"done\",\"ok\":true,\"value\":null}\n",|_|{}).is_err());
        let mut d=active();d.feed(call(1).as_bytes(),|_|{}).unwrap();
        d.feed(b"{\"t\":\"done\",\"ok\":false,\"value\":\"tool rejected\"}\n",|_|{}).unwrap();d.eof().unwrap();
    }
    #[test] fn log_total_and_structural_budgets(){
        let mut d=active();
        let log=b"{\"t\":\"log\",\"level\":\"info\",\"text\":\"x\"}\n";
        for _ in 0..1024 {d.feed(log,|_|{}).unwrap()}
        assert!(d.feed(log,|_|{}).is_err());
        let mut d=active();d.bytes=TOTAL;assert!(d.feed(b"x",|_|{}).is_err());
        assert!(parse(format!("[{}0]","0,".repeat(32769)).as_bytes()).is_err());
        let mut d=active();d.frames=8192;assert!(d.feed(log,|_|{}).is_err());
        let mut d=active();
        let big=|id|format!("{{\"t\":\"call\",\"id\":{id},\"ns\":\"api\",\"fn\":\"f\",\"args\":\"{}\"}}\n","x".repeat(800000));
        d.feed(big(1).as_bytes(),|_|{}).unwrap();d.feed(big(2).as_bytes(),|_|{}).unwrap();
        d.complete(2).unwrap();d.feed(big(3).as_bytes(),|_|{}).unwrap();
        assert!(d.feed(big(4).as_bytes(),|_|{}).is_err());
    }
    #[test] fn generated_malformed_no_panics(){
        // Deterministic bounded mutation smoke test, NOT a substitute for fuzzing.
        let seed=call(1); let mut rng=7u64;
        for _ in 0..20000 {
            rng=rng.wrapping_mul(6364136223846793005).wrapping_add(1);
            let mut b=seed.as_bytes()[..seed.len()-1].to_vec();
            let i=(rng as usize)%b.len();b[i]=(rng>>32) as u8;
            let _=parse(&b);
        }
    }
}
