# INFRASTRUCTURE - Kubernetes

Manage a cluster of Linux containers as a single system to accelerate Dev and
simplify Ops.

[Kubernetes](http://www.kubernetes.io) is an open source orchestration system 
for Docker containers. It handles scheduling onto nodes in a compute cluster 
and actively manages workloads to ensure that their state matches the users 
declared intentions. Using the concepts of "labels" and "pods", it groups the 
containers which make up an application into logical units for easy management 
and discovery.

![Kubernetes
Overview](https://pieterjong.files.wordpress.com/2015/07/graph_01.png)

We use Kubernetes for orchestrating our cluster. Kubernetes allows us to deploy
Docker images to hosts in our cluster, and allows us to monitor these
deployments. The main advantage for us, is not to worry about how and where
the instance is deployed, and ensures the instance is relaunched on crash.

Please mind, that you need to follow [The Twelve-factor
App](http://12factor.net/) methodology. Enabling your container instances to be
stateless, and can operate together in a cluster.

 > A instance should be designed in a way, it can crash and relaunched, without
 effecting other instances in the cluster.

## Deploying Kubernetes
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

We use the following `#cloud-config` for deployment of our Kubernetes cluster
on CoreOS, with Weave Net.

## Setting up Kubernetes

```yaml
#cloud-config

write_files:
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

  # Kubernetes TARBALL location
  - path: /etc/kubernetes.env
    permissions: 0644
    owner: root
    content: |
      KUBE_RELEASE_TARBALL=https://github.com/GoogleCloudPlatform/kubernetes/releases/download/v1.0.1/kubernetes.tar.gz

  #Docker config
  - path: /var/lib/kubelet/.dockercfg
    owner: core:core
    permissions: 0644
    content: |
      {
        "quay.io": {
          "auth": "PASSWORD",
          "email": ""
        }
      }

  #Docker config
  - path: /home/core/.dockercfg
    owner: core:core
    permissions: 0600
    content: |
      {
        "quay.io": {
          "auth": "PASSWORD",
          "email": ""
        }
      }

coreos:
  units:
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
```

### Kubernetes Master

Specific to the Kubernetes master are the following services:
 - Api
 - Scheduler
 - Controller-Manager

The API server exposes port 8080, allowing nodes to interact with the master
server. Because we are using a private bridge network, using Weave Net, we do
not use TLS, this is possible and we will look into this in the future.

The following `#cloud-config` will be used for the Kubernetes Master on
`azure-prd-01`.

```yaml
coreos:
  units:
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
```

### Kubernetes Node

Kubernetes nodes host the Kubelet service, and the proxy service. Allowing
communication and performing orchestration on the host. 

We use the following `#cloud-config` on the node hosts.

```yaml
coreos:
  units:
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

### Manual node registration

It is possible to manually register nodes to the master, including extra
information, as labels, on the node. This might also be usefull in debugging
problems with registering nodes.

Make sure the --register-node=false on the kubelet service, for manual node
registration.

Use the following `#cloud-config` for manual node registration.

```yaml
write_files:
  # Optional for registering nodes with the Kubernetes master
  - path: /opt/bin/register_node.sh
    permissions: '0755'
    owner: root
    content: |
      #!/bin/sh -xe
      node_id="${1}"
      master_url="${2}"
      env_label="${3}"
      until healthcheck=$(curl --fail --silent "${master_url}/healthz")
      do sleep 2
      done
      test -n "${healthcheck}"
      test "${healthcheck}" = "ok"
      printf '{
        "id": "%s",
        "kind": "Minion",
        "apiVersion": "v1beta1",
        "labels": { "environment": "%s", "host": "azure", "name": "%s" }
        }' "${node_id}" "${env_label}" "${node_id}" \
        | /opt/bin/kubectl create -s "${master_url}" -f -
      if [ $? -ne 0 ]
        then echo "Failed registering node, already registered?"
        else echo "Successfully registered node"
      fi

coreos:
  units:
    - name: kubernetes.register-node.service
      enable: true
      content: |
        [Unit]
        Description=Kubernetes Create Node
        Documentation=http://kubernetes.io/
        ConditionFileIsExecutable=/opt/bin/kubectl
        ConditionFileIsExecutable=/opt/bin/register_node.sh
        After=kubernetes.download.service
        Before=kubernetes.proxy.service kubernetes.kubelet.service
        Wants=kubernetes.download.service
        ConditionHost=!azure-prd-01
        [Service]
        ExecStart=/opt/bin/register_node.sh %H http://10.1.0.1:8080 production
        Type=oneshot
        [Install]
        WantedBy=kubernetes.node.target
```
