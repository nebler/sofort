#include <sys/socket.h>
#include <sys/wait.h>
#include <netinet/in.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
int main(int argc,char **argv) {
    int f = open(argv[1],O_RDONLY), e = errno;
    printf("read_user_marker fd=%d errno=%d\n",f,e);
    if(f>=0) { close(f);return 1; }
    f = open("/tmp/jitk-01/should-not-exist",O_CREAT|O_WRONLY,0600);e=errno;
    printf("write_temp fd=%d errno=%d\n",f,e);
    if(f>=0) { close(f);return 2; }
    int s = socket(AF_INET,SOCK_STREAM,0);e=errno;
    struct sockaddr_in a={.sin_len=sizeof(a),.sin_family=AF_INET,.sin_port=htons(9),.sin_addr.s_addr=htonl(0x7f000001)};
    int c=connect(s,(struct sockaddr*)&a,sizeof(a));e=errno;
    printf("network_connect result=%d errno=%d\n",c,e);
    close(s);if(c>=0 || e!=EPERM)return 3;
    pid_t p=fork();e=errno;
    if(p==0)_exit(4);
    printf("fork pid=%d errno=%d\n",p,e);
    if(p>0) { waitpid(p,NULL,0);return 4; }
    return 0;
}
