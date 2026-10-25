#include <stdio.h>
#include <errno.h>
#include <fcntl.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <stdlib.h>
int main(int argc, char **argv) {
    const char *paths[] = {"/etc/hosts", "/private/tmp/jitk-07/outside.txt",
                           "/private/tmp/jitk-07/kk.bin"};
    for (int i=0; i<3; i++) {
        errno=0; int fd=open(paths[i], O_RDONLY);
        printf("read %s fd=%d errno=%d\n",paths[i],fd,errno);
        if (fd>=0) close(fd);
    }
    errno=0; int s=socket(AF_INET,SOCK_STREAM,0);
    printf("socket fd=%d errno=%d\n",s,errno);
    if (s>=0) {
        struct sockaddr_in a={.sin_family=AF_INET,.sin_port=htons(argc>1?atoi(argv[1]):9)};
        inet_pton(AF_INET,"127.0.0.1",&a.sin_addr);
        errno=0; int rc=connect(s,(struct sockaddr *)&a,sizeof a);
        printf("connect rc=%d errno=%d\n",rc,errno); close(s);
    }
    return 0;
}
