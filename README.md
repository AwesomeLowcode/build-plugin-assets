## Overview

## Usage

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

