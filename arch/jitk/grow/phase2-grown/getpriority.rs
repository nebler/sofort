pub fn call(a: &[usize]) -> isize {
    if a.len() < 2 {
        return -22;
    }
    let which = a[0] as u32;
    let who = a[1] as u32;
    match which {
        0 => {
            if who == 0 || who == 1 || who == 10 { 20 } else { -3 }
        }
        1 => {
            if who == 0 || who == 1 { 20 } else { -3 }
        }
        2 => {
            if who == 0 { 20 } else { -3 }
        }
        _ => -22,
    }
}
