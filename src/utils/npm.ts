const path = require('path');
const { pathExists } = require('fs-extra');
const spawn = require('cross-spawn-promise');
const child_process = require('child_process');

async function isNPMInstalled(args) {
  return pathExists(path.join(args.workDir, 'node_modules'));
}

async function install(args) {
  const { workDir, npmClient, npmOptions } = args;
  console.log('exec install cmd');
  try {
    await spawn(npmClient, ['i', '--legacy-peer-deps', '--no-save', '-d', npmOptions], { stdio: 'inherit', cwd: workDir });
  } catch (e) {
    // TODO
  }
}

async function update(args) {
  const { workDir, npmClient, npmOptions } = args;
  console.log('exec npm update cmd');
  try {
    await spawn('rm', ['-rf', 'node_modules'], { stdio: 'inherit', cwd: workDir })
    await spawn(npmClient, ['i', '--legacy-peer-deps', '-d', npmOptions], { stdio: 'inherit', cwd: workDir });
  } catch (e) {
    // TODO
  }
}

async function isNPMModuleInstalled(args, name) {
  const modulePkgJsonPath = path.resolve(args.workDir || '', 'node_modules', name, 'package.json');
  return pathExists(modulePkgJsonPath);
}

async function exec(cmd, options) {
  return new Promise((resolve, reject) => {
    const currentProcess = child_process.exec(cmd, options, (err, stdout, stderr) => {
      if (err) {
        console.log(stderr.toString());
        reject(err);
      } else {
        resolve(stdout.toString());
      }
    });
    currentProcess.stdout.on('data', function(data) {
      console.log(data);
    });
  });
}

async function installModule(args, name) {
  if (await isNPMModuleInstalled(args, name)) return;
  const { workDir, npmClient = 'npm', npmOptions } = args;
  try {
    console.log('install modules: ', name);
    await exec(`${npmClient} i ${name} --legacy-peer-deps -d`, { stdio: 'inherit', cwd: workDir });
  } catch (e) {
    // TODO
  }
}

module.exports = {
  installModule,
  install,
  update,
};
