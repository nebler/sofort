.text
.global _start
_start:
 ldr x0,=0x83e00000
 ldr x1,=0x80000000
 br x1
