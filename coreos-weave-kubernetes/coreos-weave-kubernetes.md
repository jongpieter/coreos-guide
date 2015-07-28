# Docker, CoreOS, Weave, Kubernetes Multi-Host/Cloud Cluster

Setting up and, running a Docker cluster was a completely new and unknown area
of expertise for us. Our goal was to setup the most efficient, and cost
effictive platform, for hosting our cloud application
[Yoin-Vision](http://www.yoin-vision.com). Yoin-Vision offers facial analysis
as a service, for retail companies to gain insight in their visitors, perform
customer profiling, and offer extensive reporting, for measuring marketing
efficiency and store performance.

From a background as software engineers, we require a platform that is easy to
maintain, as well it should offer us the best performance. The platform will be
used for video analysis, and machine learning for data processing. We ended up
designing our platform, based on the micro-service architecture, using [The
Twelve-factor App](http://12factor.net/) methodology.

 > A instance should be designed and developed in a way, it can crash and be
 > relaunched, without compromising or affecting other instances in the
 > cluster.

Based on this methodology, we developed all our instances to run as Docker
containers. Giving us the freedom, in not being restricted to a single hosting
platform, but allowing us to run our containers on any platform that runs
Docker.

For testing and development, we used local and server based
[Fig](http://www.fig.sh/) deployments. We noticed that it would be cumbersome
to host Fig as a cluster, and orchestrating the cluster. We decided to go with
[Kubernetes](http://kubernetes.io) from Google, to be our docker cluster
orchestration platform. Allowing us to focus on developing Yoin-Vision.

For Yoin-Vision computing cost is an important aspect, as we are busy funding
our seed round. We have a [Microsoft
Bizspark](http://www.microsoft.com/bizspark) subscription, offering $750,-i of 
Microsoft Azure credits per month, divided to 5 accounts each with $150,- per
month. Our goal was to maximize the use of this credit for our high-available
services (website, api, database). Second we use cheap dedicated hosting from
[Hetzner](http://www.hetzner.de/en), giving $50,- machines with 8 cores, and
32GB RAM, that we will use for processing power.

# Requirements

The platform we will run, will be based on 4 Azure subscriptions. Per
subscription we launch 2 Azure Standard D1 instances, giving us most bang for
our buck. Next to the Azure instances, we will run 2+ dedicated servers, which
we can increase as we get more customers.

Kubernetes will be used as container orchestration platform. Ensuring our
containers are spawned throughout the cluster for improved redundancy. Second
it allows for defining where to host the containers, we define Azure as
high-available and Hetzner as dedicated.

Networking is setup using Weave Net, providing a easy to setup and maintain
network. We setup a container network, and a bridge network between hosts in
the cluster.

We will run our cluster on [CoreOS](http://www.coreos.com), as CoreOS is
designed for security, consistency, and reliability. Instead of
installing packages via yum or apt, CoreOS uses Linux containers to manage your
services at a higher level of abstraction. A single service’s code and all
dependencies are packaged within a container that can be run on one or many
CoreOS machines.

The following diagram displays our proposed cloud setup.
![Cloud
Architecture](https://pieterjong.files.wordpress.com/2015/07/weave-network-new-page1.png)


# Setup

For deploying our cluster, we have developed some deployment scripts. These
scripts enables us to deploy our cluster more efficient. The scripts are written
in Node.JS. The source of this deployment is hosted in my [Github
repository](https://github.com/jongpieter/coreos-guide/blob/master/coreos-weave-kubernetes/).
The source is based on the guide made by
[Errordeveloper](https://github.com/GoogleCloudPlatform/kubernetes/tree/master/docs/getting-started-guides/coreos/azure)
, on deploying Kubernetes and Weave to Coreos on Azure. 

The deployment steps are desribed in more detail in the following blog posts:
 - [Azure Cluster Setup](https://pieterjong.wordpress.com/2015/07/28/azure-cluster-setup/)
 - [Azure Local SSD optimisation](https://pieterjong.wordpress.com/2015/07/28/azure-local-ssd-optimization/)
 - [CoreOS Setup](https://pieterjong.wordpress.com/2015/07/27/coreos-cluster-setup/)
 - [Kubernetes Setup](https://pieterjong.wordpress.com/2015/07/27/kubernetes-cluster-setup/)
 - [Weave setup](https://pieterjong.wordpress.com/2015/07/27/weave-cluster-setup/)


## Azure

Is setting up the Azure environment, we use the 5 accounts from our
[Microsoft Bizspark](http://www.microsoft.com/bizspark) subscription.
Requesting a Bizspark account can take up to 2 weeks, we received ours in 3
days after contact with the program manager of Bizspark Netherlands. You need
to allocate all accounts for maximum benefits.

Next you need to login to each Azure account, and setup a domain account, that
will be assigned `subscription administrator`. This account is used for the
command line deployment. Here is a great [guide on setting up this
account](https://azure.microsoft.com/en-us/documentation/articles/xplat-cli-connect/).
You need to do this for all accounts.

 > This results in a account `[NAME]@[DOMAIN].onmicrosoft.com`

Second step is to install the requirements. You can clone our git repository
```
git@github.com:jongpieter/coreos-guide.git
```

Node.js is required to run the deployment scripts.

```bash
sudo apt-get install nodejs-legacy
sudo apt-get install npm
```

We recommend you to to globally install [Azure CLI
XPLAT](https://github.com/Azure/azure-xplat-cli) by running

```bash
sudo npm install -g azure-cli
```

Navigate into the repository dir `coreos-weave-kubernetes/azure` and run `sudo npm
install` to install all dependencies from the `package.json` file. 

Download your Azure account `.publishsettings` file from
http://go.microsoft.com/fwlink/?LinkId=254432 and store it to the `conf/azure`
folder for each subscription.

### Authentication

The cluster will only be accessible though SSH access. For this you need to
generate, or use your own SSH certificates. You can run
`cert/generate_certificate.sh` to generate the certificates used in this
deployment.

### Configuration files

We have defined several configuration file templates for deployment to Azure.
These can be found in `conf/azure`. Per subscription you need 1 configuration
file, and 1 `.publishsettings` file. 

You can modify, extend, automate the use of these configuration files as you
require. For us the use of static configuration files, allowed for more insight
into deployment, as well it gave us some documentation about the deployment.

```yaml
#deploy-config

name: "cluster-01"

ssh_key:
  key: "../cert/ssh.key"
  pem: "../cert/ssh.pem"

account:
  login:
    user: "USER@DOMAIN.onmicrosoft.com"
    password: "PASSWORD"
  subscription:
    id: "123145321532512341234"
    publish_file: "../conf/azure/cluster-01.publishsettings"
    name: "BizSpark"
    user:
      - name: "USER@DOMAIN.onmicrosoft.com"
        password: "PASSWORD"
        type: "user"

  affinity_group:
    name: "cluster-01-ag"
    label: "cluster-01-ag"
    location: "West Europe"

storage:
  account:
    name: "clusterstorage"
    label: "clusterstorage"
    affinity_group: "cluster-01-ag"
    location: "West Europe"
    type: "LRS"

network:
  vnet:
    name: "clustervnet"
    address_space: "172.16.1.0"
    cidr: "24"
    location: "West Europe"
    affinity_group: "cluster-01-ag"

  reserved_ip:
    name: "cluster-01-ip"
    label: "cluster-01-ip"
    location: "West Europe"

virtual_machines:
  - name: "azure-prd-01"
    image: "2b171e93f07c4903bcad35bda10acf22__CoreOS-Beta-723.3.0"
    size: "Standard_D1"
    service: "cluster-01"
    location: "West Europe"
    affinity_group: "cluster-01-ag"
    ssh_port: "2201"
    ssh_cert: "../cert/ssh.pem"
    vnet: "clustervnet"
    ip: "172.16.1.10"
    reserved_ip: "cluster-01-ip"
    custom_data: "../conf/coreos/cluster-01.yaml"

    endpoints:
      - name: "Weave-TCP"
        port: "6783"
        protocol: "TCP"

      - name: "Weave-UDP"
        port: "6783"
        protocol: "UDP"

  - name: "azure-prd-02"
    image: "2b171e93f07c4903bcad35bda10acf22__CoreOS-Beta-723.3.0"
    size: "Standard_D1"
    service: "cluster-01"
    location: "West Europe"
    affinity_group: "cluster-01-ag"
    ssh_port: "2202"
    ssh_cert: "../cert/ssh.pem"
    vnet: "clustervnet"
    ip: "172.16.1.11"
    reserved_ip: "cluster-01-ip"
    custom_data: "../conf/coreos/cluster-01.yaml"
```

## CoreOS

The deployment of CoreOS is done using a `#cloud-config` file, where all
services are defined that will run on the host. We will deploy both Weave and
Kubernetes as a service on CoreOS. Details of this deployment will be described
later. 

We use the following `#cloud-config` file for deployment of the first Azure 
subscription. For other deployments, we only change the initial section of the
`#cloud-config` file, to define machine specific variables.

```yaml
#cloud-config

write_files:
  - path: /etc/weave.env
    permissions: 0644
    owner: root
    content: |
      WEAVE_PASSWORD="PASSWORD"
      WEAVE_BREAKOUT_ROUTE="10.1.0.0/16"
      WEAVE_IPRANGE="10.2.0.1/16"

  - path: /etc/weave.azure-prd-01.env
    permissions: 0644
    owner: root
    content: |
      WEAVE_PEERS="-initpeercount=6"
      WEAVE_BRIDGE_ADDRESS="10.1.0.1/16"

  - path: /etc/weave.azure-prd-02.env
    permissions: 0644
    owner: root
    content: |
      WEAVE_PEERS="azure-prd-01"
      WEAVE_BRIDGE_ADDRESS="10.1.0.2/16"

  - path: /etc/kubernetes.env
    permissions: 0644
    owner: root
    content: |
      KUBE_RELEASE_TARBALL=https://github.com/GoogleCloudPlatform/kubernetes/releases/download/v1.0.1/kubernetes.tar.gz

  - path: /opt/bin/wupiao
    permissions: '0755'
    content: |
      #!/bin/bash
      # [w]ait [u]ntil [p]ort [i]s [a]ctually [o]pen
      [ -n "$1" ] && \
        until curl -o /dev/null -sIf http://${1}; do \
          sleep 1 && echo .;
        done;
      exit $?

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

  - path: /var/lib/kubelet/.dockercfg
    owner: core:core
    permissions: '0644'
    content: |
      {
        "quay.io": {
          "auth": "==KEY==",
          "email": ""
        }
      }

  - path: /home/core/.dockercfg
    owner: core:core
    permissions: '0600'
    content: |
      {
        "quay.io": {
          "auth": "==KEY==",
          "email": ""
        }
      }

coreos:
  update:
    group: beta
    reboot-strategy: off

  etcd2:
    heartbeat-interval: 500
    election-timeout: 2500

  units:
    - name: systemd-networkd-wait-online.service
      drop-ins:
        - name: 50-check-github-is-reachable.conf
          content: |
            [Service]
            ExecStart=/bin/sh -x -c \
              'until curl --silent --fail https://status.github.com/api/status.json | grep -q \"good\"; do sleep 2; done'

    - name: etcd2.service
      drop-ins:
        - name: 50-environment-variables.conf
          content: |
            [Service]
            Environment=ETCD_DATA_DIR=/var/lib/etcd2
            Environment=ETCD_NAME=%H
            EnvironmentFile=-/etc/etcd2.env
            EnvironmentFile=-/etc/etcd2.%H.env

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

    # WEAVE
    - name: weave-network.target
      enable: true
      content: |
        [Unit]
        Description=Weave
        Documentation=man:systemd.special(7)
        RefuseManualStart=no
        After=network-online.target
        Requires=install-weave.service weave-create-bridge.service weave.service
        Requires=weavedns.service weaveproxy.service
        [Install]
        WantedBy=multi-user.target
        WantedBy=kubernetes.master.target
        WantedBy=kubernetes.node.target

    - name: 10-weave.network
      runtime: false
      content: |
        [Match]
        Type=bridge
        Name=weave*
        [Network]

    - name: install-weave.service
      enable: true
      content: |
        [Unit]
        Description=Install Weave
        Documentation=http://docs.weave.works/
        Before=weave.service
        After=network-online.target docker.service
        Requires=network-online.target docker.service
        [Service]
        Type=oneshot
        RemainAfterExit=yes
        ExecStartPre=/bin/mkdir -p /opt/bin/
        ExecStartPre=/usr/bin/wget -O /opt/bin/weave \
          https://github.com/weaveworks/weave/releases/download/latest_release/weave
        ExecStartPre=/usr/bin/chmod +x /opt/bin/weave
        ExecStartPre=/opt/bin/weave --local setup
        ExecStart=/bin/echo Weave Installed
        [Install]
        WantedBy=weave-network.target

    - name: weave-create-bridge.service
      enable: true
      content: |
        [Unit]
        Description=Weave Create Bridge
        Documentation=http://docs.weave.works/
        Before=weave.service
        After=install-weave.service
        Requires=install-weave.service
        [Service]
        Type=oneshot
        RemainAfterExit=yes
        EnvironmentFile=/etc/weave.%H.env
        ExecStart=/opt/bin/weave --local create-bridge
        # Workaround for rebooting
        ExecStart=/bin/bash -c '/usr/bin/ip addr add dev weave $WEAVE_BRIDGE_ADDRESS || /bin/true'
        ExecStart=/bin/bash -c '/usr/bin/ip route add $WEAVE_BREAKOUT_ROUTE dev weave scope link || /bin/true'
        # Multicast routing
        ExecStart=/bin/bash -c '/usr/bin/ip route add 224.0.0.0/4 dev weave || /bin/true'
        [Install]
        WantedBy=weave-network.target

    # http://docs.weave.works/weave/latest_release/features.html
    - name: weave.service
      enable: true
      content: |
        [Unit]
        Description=Weave Net
        Documentation=http://docs.weave.works/
        After=docker.service install-weave.service
        Requires=docker.service install-weave.service
        [Service]
        TimeoutStartSec=0
        EnvironmentFile=-/etc/weave.env
        EnvironmentFile=-/etc/weave.%H.env
        ExecStartPre=/opt/bin/weave launch -iprange $WEAVE_IPRANGE $WEAVE_PEERS
        ExecStart=/usr/bin/docker attach weave
        Restart=on-failure
        ExecStop=/opt/bin/weave stop
        [Install]
        WantedBy=weave-network.target

    # http://docs.weave.works/weave/latest_release/weavedns.html
    - name: weavedns.service
      enable: true
      content: |
        [Unit]
        Description=Weave Run - DNS
        Documentation=http://docs.weave.works/
        After=weave.service
        Requires=weave.service
        [Service]
        TimeoutStartSec=0
        EnvironmentFile=-/etc/weave.env
        EnvironmentFile=-/etc/weave.%H.env
        ExecStartPre=/opt/bin/weave launch-dns
        ExecStart=/usr/bin/docker attach weavedns
        Restart=on-failure
        ExecStop=/opt/bin/weave stop-dns
        [Install]
        WantedBy=weave-network.target

    # http://docs.weave.works/weave/latest_release/proxy.html
    - name: weaveproxy.service
      enable: true
      content: |
        [Unit]
        Description=Weave Run - PROXY
        Documentation=http://docs.weave.works/
        After=weavedns.service
        Requires=weavedns.service
        [Service]
        TimeoutStartSec=0
        EnvironmentFile=-/etc/weave.env
        EnvironmentFile=-/etc/weave.%H.env
        ExecStartPre=/opt/bin/weave launch-proxy --with-dns
        ExecStart=/usr/bin/docker attach weaveproxy
        Restart=on-failure
        ExecStop=/opt/bin/weave stop-proxy
        [Install]
        WantedBy=weave-network.target

    - name: kubernetes.master.target
      enable: true
      command: start
      content: |
        [Unit]
        Description=Kubernetes Cluster Master
        Documentation=http://kubernetes.io/
        RefuseManualStart=no
        After=weave-network.target etcd2.service
        Requires=weave-network.target etcd2.service
        ConditionHost=azure-prd-01
        Wants=kubernetes.download.service
        Wants=kubernetes.apiserver.service
        Wants=kubernetes.scheduler.service
        Wants=kubernetes.controller-manager.service
        [Install]
        WantedBy=multi-user.target

    - name: kubernetes.node.target
      enable: true
      command: start
      content: |
        [Unit]
        Description=Kubernetes Cluster Node
        Documentation=http://kubernetes.io/
        RefuseManualStart=no
        ConditionHost=!azure-prd-01
        After=weave-network.target etcd2.service
        Requires=weave-network.target etcd2.service
        Wants=kubernetes.download.service
        Wants=kubernetes.proxy.service
        Wants=kubernetes.kubelet.service
        [Install]
        WantedBy=multi-user.target

    - name: kubernetes.download.service
      enable: true
      content: |
        [Unit]
        Description=Download Kubernetes Binaries
        Documentation=https://github.com/GoogleCloudPlatform/kubernetes
        After=network-online.target systemd-networkd-wait-online.service
        Requires=network-online.target systemd-networkd-wait-online.service
        [Service]
        EnvironmentFile=/etc/kubernetes.env
        ExecStartPre=/bin/mkdir -p /opt/bin/
        ExecStart=/bin/bash -c "curl --silent --location $KUBE_RELEASE_TARBALL | tar xzv -C /tmp/"
        ExecStart=/bin/tar xzvf /tmp/kubernetes/server/kubernetes-server-linux-amd64.tar.gz -C /opt
        ExecStartPost=/usr/bin/chmod o+rx -R /opt/kubernetes
        ExecStartPost=/bin/ln -sf /opt/kubernetes/server/bin/kubectl /opt/bin/
        ExecStartPost=/bin/rm -rf /tmp/kubernetes
        RemainAfterExit=yes
        Type=oneshot

    # Kubernetes Master on azure-prd-01
    - name: kubernetes.apiserver.service
      enable: true
      content: |
        [Unit]
        Description=Kubernetes API Server
        Documentation=http://kubernetes.io/
        ConditionFileIsExecutable=/opt/kubernetes/server/bin/kube-apiserver
        Before=kubernetes.controller-manager.service kubernetes.scheduler.service
        After=etcd2.service kubernetes.download.service
        Wants=etcd2.service kubernetes.download.service
        ConditionHost=azure-prd-01
        [Service]
        ExecStart=/opt/kubernetes/server/bin/kube-apiserver \
            --address=0.0.0.0 \
            --port=8080 \
            --kubelet-https=true \
            --secure-port=6443 \
            --service-cluster-ip-range=10.100.0.0/16 \
            --etcd-servers=http://10.1.0.1:2379,http://10.1.0.2:2379 \
            --cloud-provider=vagrant \
            --logtostderr=true \
            --v=3
        Restart=always
        RestartSec=10
        [Install]
        WantedBy=kubernetes.master.target

    - name: kubernetes.scheduler.service
      enable: true
      content: |
        [Unit]
        Description=Kubernetes Scheduler
        Documentation=http://kubernetes.io/
        ConditionFileIsExecutable=/opt/kubernetes/server/bin/kube-scheduler
        After=kubernetes.apiserver.service
        Wants=kubernetes.apiserver.service
        ConditionHost=azure-prd-01
        [Service]
        ExecStartPre=/opt/bin/wupiao 10.1.0.1:8080
        ExecStart=/opt/kubernetes/server/bin/kube-scheduler \
            --logtostderr=true \
            --master=127.0.0.1:8080
        Restart=always
        RestartSec=10
        [Install]
        WantedBy=kubernetes.master.target

    - name: kubernetes.controller-manager.service
      enable: true
      content: |
        [Unit]
        Description=Kubernetes Controller Manager
        Documentation=http://kubernetes.io/
        ConditionFileIsExecutable=/opt/kubernetes/server/bin/kube-controller-manager
        After=kubernetes.apiserver.service
        Wants=kubernetes.apiserver.service
        ConditionHost=azure-prd-01
        [Service]
        ExecStartPre=/bin/bash -x -c 'result=`wget --retry-connrefused --tries=5 127.0.0.1:8080/healthz -O -` && test -n "$${result}" && test "$${result}" = ok'
        ExecStart=/opt/kubernetes/server/bin/kube-controller-manager \
            --cloud-provider=vagrant \
            --master=127.0.0.1:8080 \
            --logtostderr=true
        Restart=always
        RestartSec=10
        [Install]
        WantedBy=kubernetes.master.target

    # Kubernetes Node on azure-prd-##
    - name: kubernetes.kubelet.service
      enable: true
      content: |
        [Unit]
        Description=Kubernetes Kubelet
        Documentation=http://kubernetes.io/
        ConditionFileIsExecutable=/opt/kubernetes/server/bin/kubelet
        After=kubernetes.download.service
        Wants=kubernetes.download.service
        ConditionHost=!azure-prd-01
        [Service]
        ExecStartPre=/bin/mkdir -p /etc/kubernetes/manifests/
        ExecStart=/opt/kubernetes/server/bin/kubelet \
            --address=0.0.0.0 \
            --port=10250 \
            --api-servers=http://10.1.0.1:8080 \
            --logtostderr=true \
            --config=/etc/kubernetes/manifests/ \
            --register-node
        # Hostname override allows refering kubelets on master by hostname
        #    --hostname-override=%H \
        #    --cluster-dns=10.1.0.3 \
        #    --cluster-domain=kube.local \
        Restart=always
        RestartSec=10
        [Install]
        WantedBy=kubernetes.node.target

    - name: kubernetes.proxy.service
      enable: true
      content: |
        [Unit]
        Description=Kubernetes Proxy
        Documentation=http://kubernetes.io/
        ConditionFileIsExecutable=/opt/kubernetes/server/bin/kube-proxy
        After=kubernetes.download.service
        Wants=kubernetes.download.service
        ConditionHost=!azure-prd-01
        [Service]
        ExecStart=/opt/kubernetes/server/bin/kube-proxy \
             --master=http://10.1.0.1:8080 \
             --logtostderr=true
        Restart=always
        RestartSec=10
        [Install]
        WantedBy=kubernetes.node.target
```

## Weave

We use Weave for managing our cluster network. Our network is divided in
multiple layers, we have one container network, one host bridge network, and 
optional local cloud networks. Our focus is connecting the host machines for 
cluster orchestration, and a container network for a internal container network, 
separated from external networks. Cluster orchestration will be managed by 
Google Kubernetes, which also offers container service discovery for exposing 
containers to external services.

Following a diagram of the cluster setup, including 2 Microsoft Azure Bizspark
subscriptions, and one dedicated server. There are 3 layers of network,
internal virtual network (172.16.1.10/24), internal Weave bridge network
(10.1.0.0/16), and Weave container network (10.2.0.0/16). The Docker container
subnet is 10.2.0.0/16, where we use Weave IPAM for automatic IP address
allocation to Docker instances.

![Weave network](https://pieterjong.files.wordpress.com/2015/07/weave-network-new-page1.png)

We start Weave with `weave launch -iprange $WEAVE_SUBNET $WEAVE_PEERS` where
the `$WEAVE_SUBNET` is `10.2.0.0/16` and `$WEAVE_PEERS` are the other hosts
Weave should connect to. Weave will automatically discover the other hosts in
the network and establish connections to them if it can (in order to avoid
unnecessary multi-hop routing). For more information about the subnet, see
[Application Isolation](http://docs.weave.works/weave/latest_release/features.html#application-isolation)

 > Note the first instance, `azure-prd-01` is launched with `-initpeercount=5` 
 > as we will launch a 5 host cluster. Please see documentation for [IPAM 
 > Initialisation](http://docs.weave.works/weave/latest_release/ipam.html#initialisation)

By using Weave Proxy service, Weave will automatically integrate with Docker.
This is a better option than using a bridge for Docker. See reference blog post
[Bridge over troubled
Weavers](http://blog.weave.works/2015/07/16/bridge-over-troubled-weavers/)

Using the Weave bridge, we can communicate through this bridge to all machines
in the cluster. We use fixed ip-addresses for each machine in the cluster.
This allowes Kubernetes to orchestrate between cloud environments.

## Kubernetes

![Kubernetes Schema](https://pieterjong.files.wordpress.com/2015/07/graph_01.png)

We use Kubernetes for orchestrating our cluster. Kubernetes allows us to deploy
Docker images to hosts in our cluster, and allows us to monitor these
deployments. The main advantage for us, is not to worry about how and where
the instance is deployed, and ensures the instance is relaunched on crash.

Kubernetes is based on master - node methodology. Having the nodes being
managed by the master Kubernetes instance.

We spawn one Kubernetes master on our `azure-prd-01` host. Because this host is
a high available cloud vm, launched on Azure. Our nodes consist of
`azure-prd-02`, `azure-prd-03`, `azure-prd-04` and, `ded-prd-01`.

Our goal is to spawn high-available instances on the Azure hosts, and
processing intensive instances on the `ded-prd-01` host.

The Docker images we use are hosted on [Quay.io](https://quay.io/), providing
us with a private image registry. The login details for Quay can be placed in a
.dockercfg file, that can be deployed in the `#cloud-config`, replace PASSWORD
with your access token.

# Deployment

After configuration of our cluster, we are ready for deployment. The deployment
for Azure is automated through the `deploy.js` script, for deployment to our
dedicated server, manual deployment is required. 

## Azure

First we deploy our Azure subscription clusters, from the folder 
`coreos-weave-kubernetes/azure`

```bash
./deploy.js create ../conf/azure/cluster-01.yaml
./deploy.js deploy ../conf/azure/cluster-01.yaml
```

Perform the above step for each subscription cluster you want to deploy. This
will take some time, so good time to grab a cup of coffee.

 > Tip, combine statements using `&&`
 > `./deploy.js create ../conf/azure/cluster-01.yaml && ./deploy.js deploy ../conf/azure/cluster-01.yaml`

## Hetzner

For deployment to Hetzner dedicated servers, it is important to have these
lines added to your `#cloud-config`

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

You have to boot into the [rescue
mode](http://wiki.hetzner.de/index.php/Hetzner_Rescue-System/en) of your
server. Copy the `#cloud-config` file to your server using `scp`

```bash
scp /conf/coreos/ded-prd-01.yaml hetzner:.
```

Login to the server by `ssh`, and install CoreOS using the following commands.

```bash
wget https://raw.github.com/coreos/init/master/bin/coreos-install
chmod +x ./coreos-install
./coreos-install -d /dev/sda -C beta -c cloud-config.yaml
```

Reboot the server, and it boots into CoreOS and will install all defined
services.

## SSH

We use `ssh_conf` files for easy navigation in our cluster. You can login to
your server with:

```bash
ssh -F ssh_conf azure-prd-01
```

SSH conf files allow definition of the certificate to use, the user, and the
host ip or dns name. Below a sample of the `ssh_conf` we use. (Mind the `tabs`)

```bash
Host *
	User core
	Compression yes
	LogLevel FATAL
	StrictHostKeyChecking no
	UserKnownHostsFile /dev/null
	IdentitiesOnly yes
	IdentityFile ./cert/ssh.key

Host azure-prd-01
	Hostname cluster-01.cloudapp.net
	Port 2201

Host azure-prd-02
	Hostname cluster-01.cloudapp.net
	Port 2202

Host azure-prd-03
	Hostname cluster-02.cloudapp.net
	Port 2203

Host azure-prd-04
	Hostname cluster-02.cloudapp.net
	Port 2204
```

# Congratulations

Congratulations, you now have setup your Docker, CoreOS, Weave, Kubernetes
server.

# Acknowledgment

[Weave](http://weave.works) team for their motivation in writing this blog, and
offering support with deployment issues. Personal thanks to Ilya and Alexis!

[Microsoft](http://www.microsoft.com) for enabling us to use the Bizspark
program, and offering us personal advice!

[Kubernetes](http://kubernetes.io) for offering a great piece of software,
allowing us to controll our cluster.



