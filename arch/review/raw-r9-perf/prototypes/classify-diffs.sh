#!/bin/sh
# R9: classify 8-byte word diffs (prototype JITK_R9_DIFFS output) of one
# steady-state reset. A word is "counter" if exactly one 32-bit half changed
# by 1..4 (refcount-like), "pointer" if old and new look like guest heap
# addresses (0x80_0000..0x90_0000 or 0), else "other". A page is
# "counter-only" if all of its changed words are counters.
awk '
function hex(s,   i,c,v){v=0;s=tolower(s);sub(/^0x/,"",s);for(i=1;i<=length(s);i++){c=index("0123456789abcdef",substr(s,i,1))-1;v=v*16+c};return v}
function cls(o,n,  oh,ol,nh,nl,d){
  oh=int(o/4294967296); ol=o-oh*4294967296; nh=int(n/4294967296); nl=n-nh*4294967296;
  if(oh==nh){d=nl-ol}else if(ol==nl){d=nh-oh}else d=99;
  if(d<0)d=-d; if(d>=1&&d<=4)return "counter";
  if((o==0||(o>=8388608&&o<9437184))&&(n==0||(n>=8388608&&n<9437184)))return "pointer";
  return "other"
}
/r9page/{ split($2,a,"="); page=a[2]; pages[page]=1; next }
/r9diff/{ split($2,a,"="); split($3,b,"="); split($4,c,"=");
  k=cls(hex(b[2]),hex(c[2])); w[k]++; pk[page","k]++; total++ }
END{
  for(p in pages){ if(pk[p",counter"]>0 && pk[p",pointer"]+pk[p",other"]==0)co++; if(pk[p",counter"]+pk[p",pointer"]+pk[p",other"]==0)none++; np++ }
  printf "words_changed=%d counter=%d pointer=%d other=%d | pages=%d counter_only_pages=%d no_word_change_pages=%d\n",total,w["counter"],w["pointer"],w["other"],np,co,none
}' "$1"
