.text
.global _start
_start:
 mov x0,#1
 mov x1,#0x5413
 adr x2,canary
 mov x8,#29
 svc #0
 cmn x0,#25
 b.ne fail
 mov x0,#-1
 svc #0
 cmn x0,#9
 b.ne fail
 mov x0,#999
 svc #0
 cmn x0,#9
 b.ne fail
 mov x0,#1
 adr x1,canary
 mov x2,#8
 mov x8,#64
 svc #0
 mov x0,#1
 adr x1,ok
 mov x2,#10
 svc #0
 mov x0,#0
 b exit
fail:
 mov x0,#1
exit:
 mov x8,#93
 svc #0
.rodata
ok: .ascii " ioctl OK\n"
.data
canary: .ascii "AAAAAAAA"
