wget https://raw.github.com/coreos/init/master/bin/coreos-install
chmod +x ./coreos-install
./coreos-install -d /dev/sda -C beta -c $1

