# INFRASTRUCTURE - CoreOS

## Setting up CoreOS

CoreOS is designed for security, consistency, and reliability. Instead of
installing packages via yum or apt, CoreOS uses Linux containers to manage your
services at a higher level of abstraction. A single service's code and all
dependencies are packaged within a container that can be run on one or many
CoreOS machines.

We will use CoreOS as operating system for hosting our containers. As the focus
of CoreOS is for cluster configurations. CoreOS will be our host, that will run
Docker, on which we can deploy our containers.

The deployment of CoreOS is easy, for bare-metal using [CoreOS
Install](https://raw.githubusercontent.com/coreos/init/master/bin/coreos-install)
or to Azure using [Azure CLI
install](https://coreos.com/os/docs/latest/booting-on-azure.html).

CoreOS is bootstrapped with a `#cloud-config` file, in which you can configure
the services on the machine. We use this file to bootstrap Weave and Kubernetes
on our hosts. The `#cloud-config` files will be reloaded on host reboot,
refreshing the configuration of the host, while files will be left unchanged.

The deployed `#cloud-config` file can be found in:
 - Bare metal
   - `/var/lib/coreos-install/user-data`
 - Azure
   - `/var/lib/waagent/CustomData`

CoreOS offers various integrated services, from which we require
[etcd](https://coreos.com/docs/etcd/) a highly-available key value store for
shared configuration and service discovery. Etcd will be used by
[Kubernetes](http://kubernetes.io/) for node discovery and key-value store.

## Configuration

### \#cloud-config
A stripped down version of our `#cloud-config` file, including the etcd2
service configuration. This configuration file will be included to deploy our
host machines.

The configuration file below will be used for the first cluster `azure-prd-01`
and `azure-prd-02`. This cluster will use a Weave network bridge, to create a
network bridge between our clusters. Etcd will use the Weave Bridge
ip-addresses.

```yaml

#cloud-config

write_files:
  - path: /etc/etcd2.env
    permissions: 0644
    owner: root
    content: |
      ETCD_INITIAL_CLUSTER_TOKEN="etcd-cluster"
      ETCD_INITIAL_CLUSTER="azure-prd-01=http://10.1.0.1:2380,azure-prd-02=http://10.1.0.2:2380,azure-prd-03=http://10.1.0.3:2380,azure-prd-04=http://10.1.0.4:2380"
      ETCD_INITIAL_CLUSTER_STATE="new"

  - path: /etc/etcd2.azure-prd-01.env
    permissions: 0644
    owner: root
    content: |
      ETCD_INITIAL_ADVERTISE_PEER_URLS="http://10.1.0.1:2380"
      ETCD_LISTEN_PEER_URLS="http://10.1.0.1:2380,http://10.1.0.1:7001"
      ETCD_LISTEN_CLIENT_URLS="http://10.1.0.1:2379,http://10.1.0.1:4001,http://127.0.0.1:2379"
      ETCD_ADVERTISE_CLIENT_URLS="http://10.1.0.1:2379"

  - path: /etc/etcd2.azure-prd-02.env
    permissions: 0644
    owner: root
    content: |
      ETCD_INITIAL_ADVERTISE_PEER_URLS="http://10.1.0.2:2380"
      ETCD_LISTEN_PEER_URLS="http://10.1.0.2:2380,http://10.1.0.2:7001"
      ETCD_LISTEN_CLIENT_URLS="http://10.1.0.2:2379,http://10.1.0.2:4001,http://127.0.0.1:2379"
      ETCD_ADVERTISE_CLIENT_URLS="http://10.1.0.2:2379"

coreos:
  update:
    group: beta
    reboot-strategy: off

  etcd2:
    heartbeat-interval: 500
    election-timeout: 2500

  units:
    - name: etcd2.service
      drop-ins:
        - name: 50-environment-variables.conf
          content: |
            [Service]
            Environment=ETCD_DATA_DIR=/var/lib/etcd2
            Environment=ETCD_NAME=%H
            EnvironmentFile=-/etc/etcd2.env
            EnvironmentFile=-/etc/etcd2.%H.env
```

Running our host with the above configuration, will spawn 2 host machines, both
running etcd2 and using the CoreOS beta image.

### Secondary clusters

The second cluster, hosting `azure-prd-03` and `azure-prd-04` will use a
similar configuration file.

```yaml

#cloud-config

write_files:
  - path: /etc/etcd2.env
    permissions: 0644
    owner: root
    content: |
      ETCD_INITIAL_CLUSTER_TOKEN="etcd-cluster"
      ETCD_INITIAL_CLUSTER="azure-prd-01=http://10.1.0.1:2380,azure-prd-02=http://10.1.0.2:2380,azure-prd-03=http://10.1.0.3:2380,azure-prd-04=http://10.1.0.4:2380"
      ETCD_INITIAL_CLUSTER_STATE="new"

  - path: /etc/etcd2.azure-prd-03.env
    permissions: 0644
    owner: root
    content: |
      ETCD_INITIAL_ADVERTISE_PEER_URLS="http://10.1.0.3:2380"
      ETCD_LISTEN_PEER_URLS="http://10.1.0.3:2380,http://10.1.0.3:7001"
      ETCD_LISTEN_CLIENT_URLS="http://10.1.0.3:2379,http://10.1.0.3:4001,http://127.0.0.1:2379"
      ETCD_ADVERTISE_CLIENT_URLS="http://10.1.0.3:2379"

  - path: /etc/etcd2.azure-prd-04.env
    permissions: 0644
    owner: root
    content: |
      ETCD_INITIAL_ADVERTISE_PEER_URLS="http://10.1.0.4:2380"
      ETCD_LISTEN_PEER_URLS="http://10.1.0.4:2380,http://10.1.0.4:7001"
      ETCD_LISTEN_CLIENT_URLS="http://10.1.0.4:2379,http://10.1.0.4:4001,http://127.0.0.1:2379"
      ETCD_ADVERTISE_CLIENT_URLS="http://10.1.0.4:2379"

coreos:
  update:
    group: beta
    reboot-strategy: off

  etcd2:
    heartbeat-interval: 500
    election-timeout: 2500

  units:
    - name: etcd2.service
      drop-ins:
        - name: 50-environment-variables.conf
          content: |
            [Service]
            Environment=ETCD_DATA_DIR=/var/lib/etcd2
            Environment=ETCD_NAME=%H
            EnvironmentFile=-/etc/etcd2.env
            EnvironmentFile=-/etc/etcd2.%H.env

```
### Dedicated machine

The dedicated machine we will include in this cluster, requires a different
`#cloud-config` file, as this will be deployed on bare-metal. Deployments on
Azure or other cloud providers, include default `#cloud-config` settings, as
the host-name, ssh-keys, and system settings. For dedicated machines these need
to be included in the `#cloud-config`. This dedicated server will not run `etcd`
, as we are running `etcd` on our high-available machines.

Below is our `#cloud-config` file for the dedicated machine.

```yaml

#cloud-config
ssh_authorized_keys:
  - ssh-rsa ###KEY###

hostname: ded-prd-01

coreos:
  update:
    group: beta
    reboot-strategy: 'off'

```


## Deployment

Deployment of our hosts to Azure and the bare-metal machine, are done using the
following commands.

### Azure

Deployment to Azure will be done with the [Azure CLI
XPLAT](http://azure.microsoft.com/en-us/documentation/articles/xplat-cli/)
written in `node.js`. The following command can be used for deployment to Azure.

```bash

azure vm create --custom-data=cloud-config.yaml --vm-size=Small --ssh=22
--ssh-cert=path/to/cert --no-ssh-password --vm-name=node-1 --location="West US"
my-cloud-service 2b171e93f07c4903bcad35bda10acf22__CoreOS-Beta-723.3.0 core

```

For our production deployment, we use a customized `node.js` Azure deployment,
based on the implementation of [Errordeveloper](https://github.com/GoogleCloudPlatform/kubernetes/tree/master/docs/getting-started-guides/coreos/azure).
That allows us to define storage, network, reserved-ip and cloud-service. This
gives more flexibility in the implementation, as well as better documentation
of the implementation. A follow-up blog post will be dedicated to this.


### Dedicated

Our dedicated server is hosted at [Hetzner](http://www.hetzner.de/en/) a German
dedicated server supplier, offering great performance for a good price.

You have to boot into the [rescue
mode](http://wiki.hetzner.de/index.php/Hetzner_Rescue-System/en) of your server
, this will allow you to install CoreOS using the following commands.

```bash

wget https://raw.github.com/coreos/init/master/bin/coreos-install
chmod +x ./coreos-install
./coreos-install -d /dev/sda -C beta -c cloud-config.yaml

```

