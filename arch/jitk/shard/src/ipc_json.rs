//! Bounded ASCII JSON validation at the IPC boundary. This is transport schema,
//! never a grant or policy decision. Node remains the only policy authority.
use std::collections::BTreeMap;
#[derive(Debug)]
pub enum Value {
    Null,
    Bool,
    Number,
    String(String),
    Array(Vec<Value>),
    Object(BTreeMap<String, Value>),
}
struct Parser<'a> {
    bytes: &'a [u8],
    at: usize,
    nodes: usize,
}
impl Parser<'_> {
    fn ws(&mut self) {
        while self
            .bytes
            .get(self.at)
            .is_some_and(|b| b.is_ascii_whitespace())
        {
            self.at += 1;
        }
    }
    fn take(&mut self, b: u8) -> Result<(), ()> {
        self.ws();
        if self.bytes.get(self.at) != Some(&b) {
            return Err(());
        }
        self.at += 1;
        Ok(())
    }
    fn hex(&mut self) -> Result<u16, ()> {
        let end = self.at.checked_add(4).ok_or(())?;
        let digits = self.bytes.get(self.at..end).ok_or(())?;
        if !digits.iter().all(u8::is_ascii_hexdigit) {
            return Err(());
        }
        let s = std::str::from_utf8(digits).map_err(|_| ())?;
        let n = u16::from_str_radix(s, 16).map_err(|_| ())?;
        self.at = end;
        Ok(n)
    }
    fn string(&mut self) -> Result<String, ()> {
        self.take(b'"')?;
        let mut out = String::new();
        loop {
            let b = *self.bytes.get(self.at).ok_or(())?;
            self.at += 1;
            match b {
                b'"' => return Ok(out),
                b'\\' => {
                    let e = *self.bytes.get(self.at).ok_or(())?;
                    self.at += 1;
                    out.push(match e {
                        b'"' => '"',
                        b'\\' => '\\',
                        b'/' => '/',
                        b'b' => '\u{8}',
                        b'f' => '\u{c}',
                        b'n' => '\n',
                        b'r' => '\r',
                        b't' => '\t',
                        b'u' => {
                            let hi = self.hex()?;
                            let n = if (0xd800..=0xdbff).contains(&hi) {
                                if self.bytes.get(self.at..self.at + 2) != Some(b"\\u") {
                                    return Err(());
                                }
                                self.at += 2;
                                let lo = self.hex()?;
                                if !(0xdc00..=0xdfff).contains(&lo) {
                                    return Err(());
                                }
                                0x10000 + ((hi as u32 - 0xd800) << 10) + (lo as u32 - 0xdc00)
                            } else {
                                hi as u32
                            };
                            char::from_u32(n).ok_or(())?
                        }
                        _ => return Err(()),
                    });
                }
                32..=126 => out.push(b as char),
                _ => return Err(()),
            }
        }
    }
    fn value(&mut self, depth: usize) -> Result<Value, ()> {
        self.ws();
        self.nodes += 1;
        if depth > 32 || self.nodes > 4096 {
            return Err(());
        }
        match self.bytes.get(self.at).copied().ok_or(())? {
            b'"' => Ok(Value::String(self.string()?)),
            b'[' => {
                self.at += 1;
                self.ws();
                let mut a = Vec::new();
                if self.bytes.get(self.at) == Some(&b']') {
                    self.at += 1;
                    return Ok(Value::Array(a));
                }
                loop {
                    a.push(self.value(depth + 1)?);
                    self.ws();
                    if self.bytes.get(self.at) == Some(&b']') {
                        self.at += 1;
                        break;
                    }
                    self.take(b',')?;
                }
                Ok(Value::Array(a))
            }
            b'{' => {
                self.at += 1;
                self.ws();
                let mut o = BTreeMap::new();
                if self.bytes.get(self.at) == Some(&b'}') {
                    self.at += 1;
                    return Ok(Value::Object(o));
                }
                loop {
                    let k = self.string()?;
                    self.take(b':')?;
                    let v = self.value(depth + 1)?;
                    if o.insert(k, v).is_some() {
                        return Err(());
                    }
                    self.ws();
                    if self.bytes.get(self.at) == Some(&b'}') {
                        self.at += 1;
                        break;
                    }
                    self.take(b',')?;
                }
                Ok(Value::Object(o))
            }
            b'n' | b't' | b'f' => {
                let (literal, value) = match self.bytes[self.at] {
                    b'n' => (b"null".as_slice(), Value::Null),
                    b't' => (b"true".as_slice(), Value::Bool),
                    _ => (b"false".as_slice(), Value::Bool),
                };
                if self.bytes.get(self.at..self.at + literal.len()) != Some(literal) {
                    return Err(());
                }
                self.at += literal.len();
                Ok(value)
            }
            b'-' | b'0'..=b'9' => {
                let start = self.at;
                if self.bytes[self.at] == b'-' {
                    self.at += 1;
                }
                match self.bytes.get(self.at) {
                    Some(b'0') => self.at += 1,
                    Some(b'1'..=b'9') => {
                        while self.bytes.get(self.at).is_some_and(u8::is_ascii_digit) {
                            self.at += 1;
                        }
                    }
                    _ => return Err(()),
                }
                if self.bytes.get(self.at) == Some(&b'.') {
                    self.at += 1;
                    let first = self.at;
                    while self.bytes.get(self.at).is_some_and(u8::is_ascii_digit) {
                        self.at += 1;
                    }
                    if self.at == first {
                        return Err(());
                    }
                }
                if self
                    .bytes
                    .get(self.at)
                    .is_some_and(|b| *b == b'e' || *b == b'E')
                {
                    self.at += 1;
                    if self
                        .bytes
                        .get(self.at)
                        .is_some_and(|b| *b == b'+' || *b == b'-')
                    {
                        self.at += 1;
                    }
                    let first = self.at;
                    while self.bytes.get(self.at).is_some_and(u8::is_ascii_digit) {
                        self.at += 1;
                    }
                    if self.at == first {
                        return Err(());
                    }
                }
                let n = std::str::from_utf8(&self.bytes[start..self.at])
                    .map_err(|_| ())?
                    .parse::<f64>()
                    .map_err(|_| ())?;
                if !n.is_finite() || n.abs() > 9007199254740991.0 {
                    return Err(());
                }
                Ok(Value::Number)
            }
            _ => Err(()),
        }
    }
}
pub fn parse(bytes: &[u8]) -> Result<Value, ()> {
    if bytes.is_empty() || bytes.len() > 16384 || bytes.iter().any(|b| *b < 32 || *b > 126) {
        return Err(());
    }
    let mut p = Parser {
        bytes,
        at: 0,
        nodes: 0,
    };
    let v = p.value(0)?;
    p.ws();
    if p.at != bytes.len() {
        return Err(());
    }
    Ok(v)
}
pub fn reply(bytes: &[u8]) -> bool {
    let Ok(Value::Object(o)) = parse(bytes) else {
        return false;
    };
    if o.len() != 1 {
        return false;
    }
    if o.contains_key("ok") {
        return true;
    }
    let Some(Value::Object(e)) = o.get("err") else {
        return false;
    };
    let (Some(Value::String(code)), Some(Value::String(message))) =
        (e.get("code"), e.get("message"))
    else {
        return false;
    };
    e.len() == 2
        && !code.is_empty()
        && code.len() <= 64
        && code.as_bytes()[0].is_ascii_uppercase()
        && code
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_')
        && message.len() <= 4096
}
fn identifier(s: &str) -> bool {
    let mut bytes = s.bytes();
    !s.is_empty()
        && s.len() <= 64
        && bytes
            .next()
            .is_some_and(|b| b.is_ascii_alphabetic() || b == b'_' || b == b'$')
        && bytes.all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'$')
}
/// Guest calls are JSON argument arrays; policy calls have a stricter envelope.
pub fn arguments(bytes: &[u8]) -> bool {
    matches!(parse(bytes), Ok(Value::Array(_)))
}
pub fn request(bytes: &[u8]) -> bool {
    let Ok(Value::Array(a)) = parse(bytes) else {
        return false;
    };
    match a.as_slice() {
        [
            Value::String(t),
            Value::String(ns),
            Value::String(function),
            Value::Array(_),
        ] => t == "call" && identifier(ns) && identifier(function),
        [Value::String(t), Value::String(level), Value::String(_)] => {
            t == "log" && ["log", "info", "warn", "error", "debug"].contains(&level.as_str())
        }
        _ => false,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn malformed_json_and_envelopes() {
        for b in [
            r#"{"ok":0,"ok":1}"#,
            r#"{"ok":01}"#,
            r#"{"ok":"\u+123"}"#,
            r#"{"ok":1e999}"#,
            r#"{"ok":"\ud800"}"#,
            r#"{"err":{"code":"bad","message":"x"}}"#,
            r#"{"ok":1,"extra":0}"#,
            r#"{"ok":[],}"#,
        ] {
            assert!(!reply(b.as_bytes()), "{b}");
        }
        assert!(reply(br#"{"ok":{"a":"\ud83d\ude00"}}"#));
        assert!(reply(br#"{"err":{"code":"DENIED","message":"denied"}}"#));
        assert!(request(br#"["call","ns","fn",[]]"#));
        assert!(!request(br#"["call","ns","fn",{}]"#));
        assert!(!request(br#"["call","invalid-name","fn",[]]"#));
        assert!(!reply(
            format!("{{\"ok\":{}0{}}}", "[".repeat(33), "]".repeat(33)).as_bytes()
        ));
    }
}
