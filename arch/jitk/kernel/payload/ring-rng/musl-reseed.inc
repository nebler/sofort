/* Appended to musl 1.2.5 mallocng/malloc.c, where private metadata is defined.
 * Safe only at this single-threaded, pre-tenant checkpoint. The live heap stays
 * intact: mallocng's only secret-dependent field is each meta_area.check. */
#include "pthread_impl.h"

void __jitk_reseed_libc(const unsigned char seed[16])
{
    uintptr_t random=0;
    uint64_t secret;
    for (size_t i=0; libc.auxv[i]; i+=2)
        if (libc.auxv[i]==AT_RANDOM) random=libc.auxv[i+1];
    assert(random);
    memcpy((void *)random, seed, 16);
    __init_ssp((void *)random);
    memcpy(&secret, seed+8, sizeof secret);
    for (struct meta_area *p=ctx.meta_area_head; p; p=p->next) {
        assert(p->check==ctx.secret);
        p->check=secret;
    }
    ctx.secret=secret;
}

void __jitk_check_libc(const unsigned char seed[16])
{
    extern uintptr_t __stack_chk_guard;
    uintptr_t guard;
    uint64_t secret;
    memcpy(&guard, seed, sizeof guard);
    ((unsigned char *)&guard)[1]=0;
    memcpy(&secret, seed+8, sizeof secret);
    assert(__stack_chk_guard==guard);
    assert(__pthread_self()->canary==guard);
    assert(ctx.secret==secret);
    for (struct meta_area *p=ctx.meta_area_head; p; p=p->next)
        assert(p->check==secret);
}
