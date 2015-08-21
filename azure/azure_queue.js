#!/usr/bin/env node

var _ = require('underscore'),
    cp = require('child_process'),
    clr = require('colors'),
    fs = require('fs'),
    inspect = require('util').inspect,
    util = require('./util.js'),
    yaml    = require('js-yaml');

var verbose = false;
var conf = {};

var hosts = {
  collection: [],
};

var task_queue = [];

exports.run_task_queue = function (dummy, breaks) {
  var breaks = breaks || true;

  var tasks = {
    todo: task_queue,
    done: [],
  };

  var pop_task = function() {
    console.log(clr.yellow('azure_wrapper/task:'), clr.grey(inspect(tasks)));
    var ret = {};
    ret.current = tasks.todo.shift();
    ret.remaining = tasks.todo.length;
    return ret;
  };

  (function iter (task) {
    if (task.current === undefined) {
      if (conf.destroying === undefined) {
        //create_ssh_conf();
        save_state();
      }
      return;
    } else {
      if (task.current.length !== 0) {
        console.log(clr.yellow('azure_wrapper/exec:'), clr.blue(inspect(task.current)));
        cp.fork('node_modules/azure-cli/bin/azure', task.current)
          .on('exit', function (code, signal) {
            tasks.done.push({
              code: code,
              signal: signal,
              what: task.current.join(' '),
              remaining: task.remaining,
            });
            if (code !== 0 && conf.destroying === undefined) {
              console.log(clr.red('azure_wrapper/fail: Exiting due to an error.'));
              if (breaks) {
                save_state();
                console.log(clr.cyan('azure_wrapper/info: You probably want to destroy and re-run.'));
                process.abort();
              }
            } else {
              iter(pop_task());
            }
        });
      } else {
        iter(pop_task());
      }
    }
  })(pop_task());
};

var save_state = function () {
  var file_name = util.join_output_file_path(conf.name, 'deployment.yml');
  try {
    conf.hosts = hosts.collection;
    //fs.writeFileSync(file_name, yaml.safeDump(conf));
    console.log(clr.yellow('azure_wrapper/info: Saved state into `%s`'), file_name);
  } catch (e) {
    console.log(clr.red(e));
  }
};

var load_state = function (file_name) {
  try {
    conf = yaml.safeLoad(fs.readFileSync(file_name, 'utf8'));
    console.log(clr.yellow('azure_wrapper/info: Loaded state from `%s`'), file_name);
    return conf;
  } catch (e) {
    console.log(clr.red(e));
  }
};

var create_ssh_key = function (prefix) {
  var opts = {
    x509: true,
    nodes: true,
    newkey: 'rsa:2048',
    subj: '/O=PieterJong/L=Amsterdam/C=NL/CN=pieterjong.nl',
    keyout: util.join_output_file_path(prefix, 'ssh.key'),
    out: util.join_output_file_path(prefix, 'ssh.pem'),
  };
  openssl.exec('req', opts, function (err, buffer) {
    if (err) console.log(clr.red(err));
    fs.chmod(opts.keyout, '0600', function (err) {
      if (err) console.log(clr.red(err));
    });
  });
  return {
    key: opts.keyout,
    pem: opts.out,
  }
}

var create_ssh_conf = function (config) {
  var file_name = util.join_output_file_path(config.name, 'ssh_conf');
  var ssh_conf_head = [
    "Host *",
    "\tHostname " + config.name + ".cloudapp.net",
    "\tUser core",
    "\tCompression yes",
    "\tLogLevel FATAL",
    "\tStrictHostKeyChecking no",
    "\tUserKnownHostsFile /dev/null",
    "\tIdentitiesOnly yes",
    "\tIdentityFile " + config.ssh_key['key'],
    "\n",
  ];

  fs.writeFileSync(file_name, ssh_conf_head.concat(_.map(config.virtual_machines, function (vm) {
    return _.template("Host <%= name %>\n\tPort <%= ssh_port %>\n")(vm);
  })).join('\n'));
  console.log(clr.yellow('azure_wrapper/info:'), clr.green('Saved SSH config, you can use it like so: `ssh -F ', file_name, '<hostname>`'));
  console.log(clr.yellow('azure_wrapper/info:'), clr.green('The hosts in this deployment are:\n'), _.map(config.virtual_machines, function (vm) { return vm.name; }));
};

exports.set_verbose = function(value) {
  verbose = value;
}

exports.queue_account = function(config) {
  task_queue.push([
    'account', 'import', config.account.subscription['publish_file'],
  ]);

  task_queue.push([
    'account', 'set', config.account.subscription['id'],
  ]);
}

exports.queue_login = function(config) {
  task_queue.push([
    'login',
    '--user=' + config.account.login['user'],
    '--password=' + config.account.login['password'],
  ]);
}

exports.queue_affinity_group = function (config) {
  var ag = config.account['affinity_group'];
  task_queue.push([
    'account', 'affinity-group', 'create',
    '--location=' + ag['location'],
    '--label=' + ag['label'],
    ag['name'],
  ]);
}

exports.queue_network = function (config) {
  var vnet = config.network.vnet;
  task_queue.push([
    'network', 'vnet', 'create',
    '--affinity-group=' + vnet['affinity_group'],
    '--address-space=' + vnet['address_space'],
    '--cidr=' + vnet['cidr'],
    vnet['name'],
  ]);
}

exports.queue_reserved_ip = function (config) {
  var rip = config.network.reserved_ip;
  task_queue.push([
    'network', 'reserved-ip', 'create',
    '--label=' + rip['label'],
    rip['name'],
    rip['location'],
  ]);
}

exports.queue_storage = function (config) {
  var account = config.storage.account;
  task_queue.push([
    'storage', 'account', 'create',
    '--affinity-group=' + account['affinity_group'],
    '--label=' + account['label'],
    '--location=' + account['location'],
    '--type=' + account['type'],
    account['name'],
  ]);
}

exports.queue_machines = function (config) {
  task_queue = task_queue.concat(_.map(config.virtual_machines, function(vm) {
    return [
      'vm', 'create',
      '--affinity-group=' + vm.affinity_group,
      '--reserved-ip=' + vm.reserved_ip,
      '--static-ip=' + vm.ip,
      '--connect=' + vm.service,
      '--virtual-network-name=' + vm.vnet,
      '--no-ssh-password',
      '--ssh-cert=' + vm.ssh_cert,
      '--vm-name=' + vm.name,
      '--ssh=' + vm.ssh_port,
      '--custom-data=' + vm.custom_data,
      '--vm-size=' + vm.size,
      vm.image,
      'core']
  }));
};

exports.queue_endpoints = function(config) {
  _.each(config.virtual_machines, function(vm) {
    _.each(vm.endpoints, function(ep) {
      task_queue.push([
        'vm', 'endpoint', 'create',
        vm.name, ep.port, ep.port,
        '--endpoint-name=' + ep.name,
        '--endpoint-protocol=' + ep.protocol,
      ]);
    })
  });
};

exports.destroy_cluster = function (config) {
  if (config.virtual_machines === undefined) {
    console.log(clr.red('deploy_queue/fail: Nothing to delete.'));
    process.abort();
  }

  conf.destroying = true;
  exports.queue_login(config);
  exports.queue_account(config);
  task_queue = task_queue.concat(_.map(config.virtual_machines, function (vm) {
    return ['vm', 'delete', '--quiet', '--blob-delete', vm['name']];
  }));

  task_queue.push(['network', 'reserved-ip', 'delete', '--quiet', config.network['reserved_ip']['name']]),
  task_queue.push(['network', 'vnet', 'delete', '--quiet', config.network['vnet']['name']]);
  task_queue.push(['storage', 'account', 'delete', '--quiet', config.storage['account']['name']]);
  task_queue.push(['account', 'affinity-group', 'delete', '--quiet', config.account['affinity_group']['name']]);

  if (verbose) {
    console.log(inspect(task_queue));
  }
  exports.run_task_queue();
};

exports.remove_machines = function (config) {
  if (config.virtual_machines === undefined) {
    console.log(clr.red('deploy_queue/fail: Nothing to delete.'));
    process.abort();
  }

  conf.destroying = true;
  exports.queue_login(config);
  exports.queue_account(config);
  task_queue = task_queue.concat(_.map(config.virtual_machines, function (vm) {
    return ['vm', 'delete', '--quiet', '--blob-delete', vm['name']];
  }));

  if (verbose) {
    console.log(inspect(task_queue));
  }
  exports.run_task_queue();
};
