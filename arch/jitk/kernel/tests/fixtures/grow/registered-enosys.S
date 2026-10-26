.text
.global _start
_start:
 mov x0,#1
 mov x1,#0xdead
 mov x2,#0
 mov x8,#29
 svc #0
 cmn x0,#38
 b.ne fail
 mov x8,#216
 svc #0
 cmn x0,#38
 b.ne fail
 mov x0,#-1
 mov x1,#-1
 mov x2,#-1
 mov x3,#-1
 mov x8,#134
 svc #0
 cmn x0,#38
 b.ne fail
 mov x8,#135
 svc #0
 cmn x0,#38
 b.ne fail
 mov x8,#511
 svc #0
 cmn x0,#38
 b.ne fail
 mov x0,#0
 b done
fail: mov x0,#1
done: mov x8,#94
 svc #0
.data
.quad 0
