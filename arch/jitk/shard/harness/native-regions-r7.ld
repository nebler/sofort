ENTRY(_start)
PHDRS {
 text PT_LOAD FILEHDR PHDRS FLAGS(5);
 ro PT_LOAD FLAGS(4);
 data PT_LOAD FLAGS(6);
}
SECTIONS {
 . = 0x400000 + SIZEOF_HEADERS;
 .text : { *(.text*) *(.rodata*) } :text
 . = 0x67e000;
 .boundary_ro : { KEEP(*(.boundary_ro)) } :ro
 . = 0x67f000;
 .boundary_rw : { KEEP(*(.boundary_rw)) } :data
 /DISCARD/ : { *(.comment*) *(.eh_frame*) }
}
