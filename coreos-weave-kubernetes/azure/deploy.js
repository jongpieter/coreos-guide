#!/usr/bin/env node

var azure   = require('./azure_queue.js'),
    cp      = require('child_process'),
    fs      = require('fs'),
    program = require('commander'),
    prompt  = require('prompt'),
    yaml    = require('js-yaml');


function on_error(error) {
  console.log(error);
  process.exit(1);
}

function request_confirmation(callback) {
  var property = {
    name: 'yesno',
    message: 'are you sure?',
    validator: /y[es]*|n[o]?/,
    warning: 'Must respond yes or no',
    default: 'no'
  };

  prompt.start();
  prompt.get(property, function (error, result) {
    if (error) { return on_error(error); }
    callback(/y[es]*?/.test(result.yesno));
  });
}

function load_config(config_file) {
  // Get document, or throw exception on error
  try {
    return yaml.safeLoad(fs.readFileSync(config_file, 'utf8'));
  } catch (e) {
    on_error(e);
  }
};

program
  .version('1.0.0')
  .option('-c, --config <path>', 'set config path.')
  .option('-v, --verbose', 'Verbose')// false, {isDefault: true})

program
  .command('create <config>')
  .description('Create the config deployment')
  .option('-t, --test', 'Dry run, displays commands to execute')
  .action(function(config, options) {
    if (options.test) {
      console.log('Generating test deployment for %s', config);
    } else {
      console.log('Deploying environment with %s', config);
      create(config);
    }
  });

program
  .command('destroy <config>')
  .description('Destroy the deployed config')
  .option('-t, --test', 'Dry run, displays commands to execute')
  .action(function(config, options) {
    if (options.test) {
      console.log('Generate test commands for %s', config);
    } else {
      console.log('Destroy deployment %s', config)
      request_confirmation(function(result) {
        if (!result) { return 1; }
        try { remove(config); } catch (e) { console.log(e); }
        destroy(config);
      });
    }
  });

program
  .command('deploy <config>')
  .description('Deploy machines to the config deployment')
  .option('-t, --test', 'Dry run, displays commands to execute')
  .option('-f, --full', 'Full deployment')
  .action(function(config, options) {
    if (options.test) {
      console.log('Generating test deployment for %s', config);
    } else {
      console.log('Deploying environment with %s', config);
      if (options.full) {
        create(config);
      }
      deploy(config);
    }
  });

program
  .command('remove <config>')
  .description('Remove machines from the deployed config')
  .option('-t, --test', 'Dry run, displays commands to execute')
  .action(function(config, options) {
    if (options.test) {
      console.log('Generate test commands for %s', config);
    } else {
      console.log('Remove machines from deployment %s', config)
      request_confirmation(function(result) {
        if (!result) { return 1; }

        remove(config);
      });
    }
  });

program
  .command('redeploy <config>')
  .description('Re-deploy machines to the config deployment')
  .option('-t, --test', 'Dry run, displays commands to execute')
  .action(function(config, options) {
    if (options.test) {
      console.log('Generating test deployment for %s', config);
    } else {
      console.log('Re-deploying environment with %s', config);
      request_confirmation(function(result) {
        if (!result) { return 1; }

        try { remove(config); } catch (e) { console.log(e); }
        deploy(config);
      });
    }
  });


program.parse(process.argv);

function create(config_file) {
  config = load_config(config_file);
  if (program.verbose) {
    console.log(config);
  }

  azure.run_task_queue([
    azure.queue_login(config),
    azure.queue_account(config),
    azure.queue_affinity_group(config),
    azure.queue_storage(config),
    azure.queue_network(config),
    azure.queue_reserved_ip(config),
  ], /* Don't break on error */ false);
}

function destroy(config_file) {
  config = load_config(config_file);
  if (program.verbose) {
    console.log(config);
    azure.set_verbose(true);
  }

  azure.destroy_cluster(config);
}

function deploy(config_file) {
  config = load_config(config_file);
  if (program.verbose) {
    console.log(config);
  }

  azure.run_task_queue([
    azure.queue_login(config),
    azure.queue_account(config),
    azure.queue_machines(config),
    azure.queue_endpoints(config),
  ], /* Don't break on error */ false);
}

function remove(config_file) {
  config = load_config(config_file);
  if (program.verbose) {
    console.log(config);
    azure.set_verbose(true);
  }

  azure.remove_machines(config);
}
