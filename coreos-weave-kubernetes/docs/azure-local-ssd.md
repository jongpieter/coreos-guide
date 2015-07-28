# INFRASTRUCTURE - Azure Local SSD

Special for Azure D# instances, these instances are equiped with a local SSD
drive. This local SSD drive needs to be mounted to be used by Docker and
Kubernetes.

The local SSD drive offers a huge performance boost, compared to attached
disks. The internal SSD is not limited on IO and throughput. See the
[D-Series Performance
Expectations](http://azure.microsoft.com/blog/2014/10/06/d-series-performance-expectations/)
blog post for more information about the Azure Standard D1 performance.

 > One side note, the local disk is ephemeral, so on host reboot it can be
 > wiped, and should therfor only be used as temp storage.

Second we use OverlayFS, as compared to BTFRS for Docker. Which also provides
us with a huge performance boost. See the blog post [Overview Storage
Scalability
Docker](http://developerblog.redhat.com/2014/09/30/overview-storage-scalability-docker/)
for more information.

## Deployment

We deploy the Azure Standard D1 host with the following `#cloud-config`. First
the tmp drive `/dev/sdb` is unmounted, wiped, formatted as `ext4`. Second it is
mounted as docker storage `/var/lib/docker`.

```yaml

#cloud-config

coreos:
  units:
    # AZURE
    - name: docker.service
      drop-ins:
        - name: 10-overlayfs.conf
          content: |
            [Service]
            Environment='DOCKER_OPTS="--storage-driver=overlay"'

    - name: format-ephemeral.service
      command: start
      content: |
        [Unit]
        Description=Format Ephemeral Volume
        Documentation=https://coreos.com/os/docs/latest/mounting-storage.html
        Before=docker.service var-lib-docker.mount
        After=dev-sdb.device
        Requires=dev-sdb.device
        [Service]
        Type=oneshot
        RemainAfterExit=yes
        ExecStart=/bin/bash -c '/usr/bin/umount -f /mnt/resource || /bin/true'
        ExecStart=/bin/bash -c '/usr/bin/umount -A /dev/sdb || /bin/true'
        ExecStart=/usr/bin/rm -rf /mnt/resource
        ExecStart=/usr/sbin/wipefs -f /dev/sdb
        ExecStart=/usr/sbin/mkfs.ext4 -F /dev/sdb
        [Install]
        RequiredBy=var-lib-docker.mount

    - name: var-lib-docker.mount
      enable: true
      content: |
        [Unit]
        Description=Mount /var/lib/docker
        Documentation=https://coreos.com/os/docs/latest/mounting-storage.html
        Before=docker.service
        After=format-ephemeral.service
        Requires=format-ephemeral.service
        [Install]
        RequiredBy=docker.service
        [Mount]
        What=/dev/sdb
        Where=/var/lib/docker
        Type=ext4
```

