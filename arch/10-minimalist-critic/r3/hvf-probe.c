#include <Hypervisor/Hypervisor.h>
#include <stdio.h>
#include <string.h>
int main(int argc, char **argv) {
    hv_vm_config_t config = NULL;
    uint32_t standard = 0, maximum = 0, selected = 0;
    hv_return_t get_default = 0, get_maximum = 0, set = 0;
    if (argc > 1) {
        config = hv_vm_config_create();
        get_default = hv_vm_config_get_default_ipa_size(&standard);
        get_maximum = hv_vm_config_get_max_ipa_size(&maximum);
        selected = strcmp(argv[1], "max") == 0 ? maximum : standard;
        set = hv_vm_config_set_ipa_size(config, selected);
    }
    hv_return_t rc = hv_vm_create(config);
    const char *name = rc == HV_SUCCESS ? "HV_SUCCESS" :
                       rc == HV_NO_RESOURCES ? "HV_NO_RESOURCES" :
                       rc == HV_BUSY ? "HV_BUSY" : "OTHER";
    hv_return_t destroy = rc == HV_SUCCESS ? hv_vm_destroy() : 0;
    printf("{\"create_rc\":\"0x%x\",\"create_name\":\"%s\",\"destroy_rc\":\"0x%x\",\"default_ipa\":%u,\"max_ipa\":%u,\"selected_ipa\":%u,\"get_default_rc\":%u,\"get_max_rc\":%u,\"set_ipa_rc\":%u}\n", rc, name, destroy, standard, maximum, selected, get_default, get_maximum, set);
    return rc == HV_SUCCESS && destroy != HV_SUCCESS ? 1 : 0;
}
