/* ChaCha20 block (RFC 8439), used only to separate fresh 128-bit host entropy
 * into independent repair domains. No entropy is obtained from clocks/IDs. */
#include <stdint.h>
#include <string.h>

static uint32_t rng_load32(const unsigned char *p)
{
    return (uint32_t)p[0] | (uint32_t)p[1]<<8 |
           (uint32_t)p[2]<<16 | (uint32_t)p[3]<<24;
}

static uint32_t rng_rotl(uint32_t x, int n)
{
    return x<<n | x>>(32-n);
}

static void rng_block(const unsigned char seed[16], uint32_t domain,
                      unsigned char out[64])
{
    uint32_t s[16] = {0x61707865,0x3320646e,0x79622d32,0x6b206574};
    uint32_t x[16];
    for (int i=0; i<8; i++) s[4+i] = rng_load32(seed+4*(i%4));
    s[12] = domain;
    memcpy(x, s, sizeof x);
#define QR(a,b,c,d) do { \
    x[a]+=x[b]; x[d]=rng_rotl(x[d]^x[a],16); \
    x[c]+=x[d]; x[b]=rng_rotl(x[b]^x[c],12); \
    x[a]+=x[b]; x[d]=rng_rotl(x[d]^x[a],8); \
    x[c]+=x[d]; x[b]=rng_rotl(x[b]^x[c],7); \
} while (0)
    for (int i=0; i<10; i++) {
        QR(0,4,8,12); QR(1,5,9,13); QR(2,6,10,14); QR(3,7,11,15);
        QR(0,5,10,15); QR(1,6,11,12); QR(2,7,8,13); QR(3,4,9,14);
    }
#undef QR
    for (int i=0; i<16; i++) {
        uint32_t v=x[i]+s[i];
        for (int j=0; j<4; j++) out[4*i+j]=v>>(8*j);
    }
    explicit_bzero(s, sizeof s);
    explicit_bzero(x, sizeof x);
}
