// Build-time embedding; no host filesystem device or guest initrd.
.section .rodata.qjs,"a"
.balign 4096
.global qjs_start, qjs_end
qjs_start:
.incbin "/tmp/jitk-01/qjs-static"
qjs_end:
