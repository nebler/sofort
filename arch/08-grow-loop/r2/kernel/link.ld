ENTRY(_start)
SECTIONS {
 . = 0x80000000;
 .text : { KEEP(*(.text.boot)) *(.text*) }
 . = ALIGN(4096); __ro_start = .;
 .rodata : { *(.rodata*) }
 . = ALIGN(4096); __rw_start = .;
 .data : { *(.data*) }
 .bss (NOLOAD) : { __bss_start = .; *(.bss*) *(COMMON) . = ALIGN(16); __bss_end = .; }
 . = ALIGN(4096); __guard_start = .; . += 4096;
 . += 65536; __stack_top = .;
 __kernel_end = .;
 /DISCARD/ : { *(.eh_frame*) *(.comment*) }
}
