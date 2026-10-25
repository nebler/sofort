// Diagnostic only: disable THP for this process and exec the unchanged VMM.
#define _GNU_SOURCE
#include <sys/prctl.h>
#include <unistd.h>
#include <stdio.h>
int main(int argc,char **argv) {
    if(argc<2)return 2;
    if(prctl(PR_SET_THP_DISABLE,1,0,0,0)) {perror("PR_SET_THP_DISABLE");return 1;}
    execv(argv[1],argv+1);perror("execv");return 1;
}
