ENTRY(_start)
SECTIONS {
 . = 0x80000000;
 .text : { *(.text*) *(.rodata*) }
 .data : { *(.data*) }
 . = ALIGN(4096);
 __bss_start = .;
 .bss (NOLOAD) : { *(.bss*) *(COMMON) }
 . = ALIGN(16); __bss_end = .;
 . += 16384; __stack_top = .;
}
