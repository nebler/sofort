#!/bin/sh
# R9: classify one steady-state reset's privately CoW'd pages (from the
# prototype's JITK_R9_PAGES output) by arena region. Usage: classify-pages.sh FILE.steady NAME
awk -v f="$2" '
function hex(s,   i,c,v){v=0;s=tolower(s);sub(/^0x/,"",s);for(i=1;i<=length(s);i++){c=index("0123456789abcdef",substr(s,i,1))-1;v=v*16+c};return v}
{
  split($2,a,"="); split($3,b,"="); split($4,c,"=");
  off=hex(a[2]); ch=b[2]+0; n++; tot+=ch;
  if(ch<=64)small++; if(ch==0)ident++; if(c[2]+0==0)zero++;
  reg="qjs-heap";
  if(off>=hex("1d00000"))reg="transport";
  else if(off<hex("1818000"))reg="kernel-data";
  else if(off<hex("1850000"))reg="low-arena";
  else if(off>=hex("191f000") && off<hex("193f000"))reg="user-stack";
  else if(off==hex("193f000"))reg="canary";
  r[reg]++; rb[reg]+=ch
}
END{
  printf "%s pages=%d KiB=%d changed_bytes=%d (%.1f%% of dirtied page bytes) pages_changed<=64B=%d net_identical=%d all_zero_now=%d\n",f,n,n*4,tot,100*tot/(n*4096),small,ident,zero;
  for(k in r)printf "  %-12s pages=%3d changed_bytes=%6d\n",k,r[k],rb[k]
}' "$1"
