// Small static event-loop workload: wait for stdin, consume one request,
// then verify ready stdout, ignored fd, bad fd, bad pointers and timeout.
.text
.global _start
_start:
 adr x0,pin
 mov x1,#1
 mov x2,#0
 mov x3,#0
 mov x4,#8
 mov x8,#73
 svc #0
 cmp x0,#1
 b.ne fail
 adr x9,pin
 ldrh w10,[x9,#6]
 cmp w10,#1
 b.ne fail
 mov x0,#0
 adr x1,buf
 mov x2,#5
 mov x8,#63
 svc #0
 cmp x0,#5
 b.ne fail
 adr x0,pout
 mov x1,#1
 adr x2,zero
 mov x3,#0
 mov x4,#8
 mov x8,#73
 svc #0
 cmp x0,#1
 b.ne fail
 adr x9,pout
 ldrh w10,[x9,#6]
 cmp w10,#4
 b.ne fail
 adr x0,ignored
 svc #0
 cbnz x0,fail
 adr x0,badfd
 svc #0
 cmp x0,#1
 b.ne fail
 adr x9,badfd
 ldrh w10,[x9,#6]
 cmp w10,#32
 b.ne fail
 mov x0,#0
 svc #0
 cmn x0,#14
 b.ne fail
 mov x1,#0
 adr x2,negative
 svc #0
 cmn x0,#22
 b.ne fail
 mov x0,#0
 adr x2,zero
 svc #0
 cbnz x0,fail
 mov x0,#1
 adr x1,buf
 mov x2,#5
 mov x8,#64
 svc #0
 mov x0,#1
 adr x1,ok
 mov x2,#10
 svc #0
 mov x0,#0
 b exit
fail: mov x0,#1
exit: mov x8,#94
 svc #0
.rodata
ok: .ascii " ppoll OK\n"
.data
.balign 8
pin: .word 0
 .hword 1,0
pout: .word 1
 .hword 4,0
ignored: .word -1
 .hword 0,0
badfd: .word 999
 .hword 1,0
zero: .quad 0,0
negative: .quad 0,-1
buf: .ascii "AAAAA"
