## Overview

### Step One

Build an assets.json by a json manifest file which includes the information of plugins, setters, components or other lowcode asset; so that you can dynamic load almost all lowcode assets.

### Step Two

You can load the assets.json with [lowcode-boot](https://github.com/AwesomeLowcode/lowcode-boot) easily; but if you don't want to use `lowcode-boot`, you can load it by your self, just take a look at the [implementation in lowcode-boot](https://github.com/AwesomeLowcode/lowcode-boot/blob/18ea77a137ed7fa67c1add6589ad29d1f538ab8c/src/index.tsx#L38).

## Usage

### Init

init an empty project.

```
npm init
```

### Install

```
echo 'package-lock=false' >> .npmrc
echo 'package-lock.json' >> .gitignore

npm i @alib/build-scripts @ablula/build-plugin-assets -S --legacy-peer-deps
```

### Add build.assets.js

```
module.exports = {
  plugins: [
    [
      '@ablula/build-plugin-assets',
    ],
  ],
};


```

### Add manifest.json

```
{
	"name": "lowcode-assets-jinchan",
	"version": "0.0.1",
	"plugins": [{
		"npm": "@alilc/lowcode-plugin-undo-redo",
		"version": "^1.x"
	}, {
		"npm": "@alilc/lowcode-plugin-code-generator",
		"version": "^1.x"
	}, {
		"npm": "@alilc/lowcode-plugin-schema",
		"version": "^1.x"
	}, {
		"npm": "@alilc/lowcode-plugin-simulator-select",
		"version": "^1.x"
	}, {
		"npm": "@alilc/lowcode-plugin-components-pane",
		"version": "^2.x"
	}],
	"setters": [{
		"name": "BehaviorSetter",
		"npm": "@alilc/lowcode-setter-behavior",
		"version": "1.0.0"
	}],
	"components": [{
		"name": "AlilcLowcodeMaterials",
		"npm": "@alilc/lowcode-materials",
		"version": "1.1.0"
	}, {
		"name": "AlifdFusionUI",
		"npm": "@alifd/fusion-ui",
		"version": "2.0.1"
	}]
}
```

### Modify package.json

```
...
  "files": ["build"],
  "main": "build/lowcode/ext.js",
  "scripts": {
    "start": "build-scripts start --config ./build.assets.js",
    "build": "build-scripts build --config ./build.assets.js",
    "prepublishOnly": "npm run build"
  },
...
```

### Take a look

```
npm start

// then open localhost:3333
```

### Build your assets.json

```
npm run build
```

### Publish

```
npm publish
```

