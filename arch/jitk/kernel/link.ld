ENTRY(_start)
SECTIONS {
 . = 0x80000000;
 .text : { KEEP(*(.text.boot)) *(.text*) }
 . = ALIGN(4096); __ro_start = .;
 .rodata : { KEEP(*(.rodata.arena)) *(.rodata*) }
 . = DEFINED(__ring_arena) ? __ring_arena : ALIGN(4096); __rw_start = .;
 .data : { *(.data*) }
 .bss (NOLOAD) : { __bss_start = .; *(.bss*) *(COMMON) . = ALIGN(16); __bss_end = .; }
 . = ALIGN(4096); __guard_start = .; . += 4096;
 . += 65536; __stack_top = .;
 __kernel_end = .;
 ASSERT(DEFINED(__ring_arena) || __kernel_end < 0x80080000, "kernel overlaps packed qjs")
 . = 0x80080000;
 .packed : { KEEP(*(.packed)) }
 /DISCARD/ : { *(.eh_frame*) *(.comment*) }
}
