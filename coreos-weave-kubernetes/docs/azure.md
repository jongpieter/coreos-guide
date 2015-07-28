# INFRASTRUCTURE - Azure

Microsoft Azure Virtual Machines allow you to deploy a wide range of computing
solutions in an agile way. With Virtual Machines, you can deploy nearly
instantaneously and you pay only by the minute. With Windows, Linux, SQL
Server, Oracle, IBM, SAP, and BizTalk, you can deploy any workload, any
language, on nearly any operating system.

![Virtual
Machine](https://pieterjong.files.wordpress.com/2015/07/new-virtual-machine.png)

## Optimize Azure deployment

Managing and deploying clusters in Azure is a delicate task. Microsoft Azure is
managed through the webportal or API, the latter having many supported plugins.
We use the [Azure CLI XPLAT](https://github.com/Azure/azure-xplat-cli) for
managing our cluster, and have our deployment configuration based on
[Errordeveloper - Kubernetes on Azure with CoreOS and
Weave](https://github.com/GoogleCloudPlatform/kubernetes/tree/master/docs/getting-started-guides/coreos/azure)

Our goal is to maximize the Azure credits offered by the [Microsoft
Bizspark](https://www.microsoft.com/bizspark/). The program offers a total of
$750,- per month to spend on Azure, based on 5 account with each $150,- of
credits. We want to optimize the utilization of these accounts, by running 2
Standard D1 instances per subscription, and interconnecting them using Weave
Net. Providing the basis for our Docker container cluster. 

Each subscription hosts 2 Standard D1 computing instances, that are linked to a
Cloud Service, in a private VNET, attached to Azure storage for VHD storage,
and are offered a high performance local SSD of 50GB. See our other blog post
for optimizing utilization of this local SSD with Docker.

The Cloud Service and local VNET, save bandwith for local instance to instance
communication. One instance is exposed from the Cloud Service, so it can be
accessed by the other subscriptions to `cloudservice.cloudapp.net`. We expose
port `TCP 6783` and `UDP 6783` for Weave to connect the subscriptions.

## Install Azure CLI XPLAT

You will need to have [Node.js](http://nodejs.org/download/) installed on you 
machine. If you have previously used Azure CLI, you should have it already

```bash
sudo apt-get install nodejs-legacy
sudo apt-get install npm
```

You install the Azure CLI with

```bash
sudo npm install -g azure-cli
```

## Authenticat with Azure

Authentication with Azure can be tricky to start with, as you need to create a
domain account, make this account subscription admin, and use this account to
login to the portal and for api access. We found a great guide for setting this
up at [How to connect to your Azure
subscription](https://azure.microsoft.com/en-us/documentation/articles/xplat-cli-connect/)

Next you will need to download your `.publishsettings` file, for authentication
with the API.

```bash
azure account download
```

This will return the [link](http://go.microsoft.com/fwlink/?LinkId=254432) to 
download the `.publishsettings` file.

```text
info:    Executing command account download
info:    Launching browser to http://go.microsoft.com/fwlink/?LinkId=254432
help:    Save the downloaded file, then execute the command
help:      account import <file>
info:    account download command OK
```

## Deployment to Azure

We use configuration files per subscription cluster. This configuration file is
formatted in YAML. The reason we use these config files, is for
reviewability and as documentation. We use these config files to create,
deploy, redeploy, remove, and destroy the cluster. Allowing us to move a
configuration between subscriptions.

For our first subscription cluster, we use the following configuration file.
 > Because this is a development deployment, we store passwords in the
 > configuration file. Second switching subscriptions, sometimes requires
 > logging in, as well as the `.publishsettings` file.

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
    id: "12357234-12473485-1234852"
    publish_file: "../conf/azure/cluster-01.publishsettings"
    name: "BizSpark"
    user:
      - name: "USER@DOMAIN.onmicrosoft.com"
        type: "user"
        password: "PASSWORD"

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
    # IPs 1-10 are reserved in Azure
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
    #image: "2b171e93f07c4903bcad35bda10acf22__CoreOS-Alpha-752.1.0"
    size: "Standard_D1"
    service: "cluster-01"
    location: "West Europe"
    affinity_group: "cluster-01-ag"
    ssh_port: "2202"
    ssh_cert: "../cert/ssh.pem"
    vnet: "clustervnet"
    # IPs 1-10 are reserved in Azure
    ip: "172.16.1.11"
    reserved_ip: "cluster-01-ip"
    custom_data: "../conf/coreos/cluster-01.yaml"

```

Deploy the subscription cluster using the following command.

```bash
./deploy.js deploy ../conf/azure/cluster-01.yaml
```

## Deployment file

```text
  Usage: deploy [options] [command]


  Commands:

    create [options] <config>    Create the config deployment
    destroy [options] <config>   Destroy the deployed config
    deploy [options] <config>    Deploy machines to the config deployment
    remove [options] <config>    Remove machines from the deployed config
    redeploy [options] <config>  Re-deploy machines to the config deployment

  Options:

    -h, --help           output usage information
    -V, --version        output the version number
    -c, --config <path>  set config path.
    -v, --verbose        Verbose
```

The deployment file offers you different options. To setup a fresh cluster use
the following commands.

Create:
```bash
./deploy.js create ../conf/azure/cluster-01.yaml
./deploy.js deploy ../conf/azure/cluster-01.yaml
```

To destroy the cluster, use the following commands.

```bash
./deploy.js remove ../conf/azure/cluster-01.yaml
./deploy.js detroy ../conf/azure/cluster-01.yaml
```


