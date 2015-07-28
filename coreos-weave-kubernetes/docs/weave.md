# INFRASTRUCTURE - Weave

[Weave Net](http://weave.works/net/) is a networking service that developers
can love. Write your application any way you like, and let Weave Net take care
of all the networking for you. Weave Net does not require any integration with
special APIs so there is no new application code or operational re-tooling.
Because Weave Net is completely integrated into the Docker way, things like
continuous integration and staging just work. Find out more about Weave Net.

~[Weave](https://pieterjong.files.wordpress.com/2015/07/weave.png)

## Setting up Weave

Weave Net makes it as easy as possible for developers to create a network of
Docker containers. Weave Net consists of a network layer, dns service, and
docker plugin. Weave provides a total solution for your container network, as
well for the host machines it operates on.

We run our Docker cluster on CoreOS. We want to run our Docker instances in
combination with a Weave network. This allows us to connect Docker instances
over multiple hosts, and even multiple clouds. We use Weave IPAM for automatic
ip allocation to Docker instances, and Weave DNS to allow containers looking up
other containers through simple DNS queries.

Our network is divided in multiple layers, we have one container network, one
host bridge network, and optional local cloud networks. Our focus is connecting
the host machines for cluster orchestration, and a container network for a
internal container network, separated from external networks. Cluster
orchestration will be managed by Google Kubernetes, which also offers container
service discovery for exposing containers to external services.

Following a diagram of the cluster setup, including 2 Microsoft Azure Bizspark
subscriptions, and one dedicated server. There are 3 layers of network,
internal virtual network (172.16.1.10/24), internal Weave bridge network
(10.1.0.0/16), and Weave container network (10.2.0.0/16). The Docker container
subnet is 10.2.0.0/16, where we use Weave IPAM for automatic IP address
allocation to Docker instances.

![Weave Network Overview](https://pieterjong.files.wordpress.com/2015/07/weave-network-new-page1.png)

TL;DR; Final Weave network config

### Default cloud-config file

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

coreos:
  units:
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
        EnvironmentFile=/etc/weave.env
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
```

### Cluster-01 - azure-prd-01 and azure-prd-02

Configuration settings for `azure-prd-01` and `azure-prd-02`.

```yaml
#cloud-config

write_files:
  - path: /etc/weave.azure-prd-01.env
    permissions: 0644
    owner: root
    content: |
      WEAVE_PEERS="-initpeercount=5"
      WEAVE_BRIDGE_ADDRESS="10.1.0.1/16"

  - path: /etc/weave.azure-prd-02.env
    permissions: 0644
    owner: root
    content: |
      WEAVE_PEERS="azure-prd-01"
      WEAVE_BRIDGE_ADDRESS="10.1.0.2/16"
```

### Cluster-02 - azure-prd-03 and azure-prd-04

Configuration settings for `azure-prd-03` and `azure-prd-04`.

```yaml
#cloud-config

write_files:
  - path: /etc/weave.azure-prd-03.env
    permissions: 0644
    owner: root
    content: |
      WEAVE_PEERS="cluster-01.cloudapp.net"
      WEAVE_BRIDGE_ADDRESS="10.1.0.3/16"

  - path: /etc/weave.azure-prd-04.env
    permissions: 0644
    owner: root
    content: |
      WEAVE_PEERS="azure-prd-03"
      WEAVE_BRIDGE_ADDRESS="10.1.0.4/16"
```

### Cluster-03 - ded-prd-01

Configuration settings for the dedicated server `ded-prd-01`.

```yaml
#cloud-config

write_files:
  - path: /etc/weave.azure-prd-03.env
    permissions: 0644
    owner: root
    content: |
      WEAVE_PEERS="cluster-01.cloudapp.net"
      WEAVE_BRIDGE_ADDRESS="10.1.0.5/16"
```

We use system environment variables per host, for defining the fixed host ip in
the Weave bridge network, and the Weave settings as password and container
subnet.

We start Weave with `weave launch -iprange $WEAVE_SUBNET $WEAVE_PEERS` where
the `$WEAVE_SUBNET` is `10.2.0.0/16` and `$WEAVE_PEERS` are the other hosts
Weave should connect to. Weave will automatically discover the other hosts in
the network and establish connections to them if it can (in order to avoid
unnecessary multi-hop routing). For more information about the subnet, see
[Application Isolation](http://docs.weave.works/weave/latest_release/features.html#application-isolation)

Note the first instance, `azure-prd-01` is launched with `-initpeercount=5` as
we will launch a 5 host cluster. Please see documentation for [IPAM
Initialisation](http://docs.weave.works/weave/latest_release/ipam.html#initialisation)

\#TODO: Review if fixed ip is better
For DNS operations in the cluster and between instances, we use Weave DNS. For
control over DNS instances, we use fixed IP addresses for our Weave DNS
instances. These need to be provided with a CIDR, in our case we use
`10.254.0.1/24`

By using Weave Proxy service, Weave will automatically integrate with Docker.
This is a better option than using a bridge for Docker. See reference blog post
[Bridge over troubled Weavers](http://blog.weave.works/2015/07/16/bridge-over-troubled-weavers/)

Using the Weave bridge, we can communicate through this bridge to all machines
in the cluster. We use fixed ip-addresses for each machine in the cluster.
This allowes Kubernetes to orchestrate between cloud environments.

