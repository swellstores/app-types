# Swell App Types

TypeScript bindings for Swell Apps.

## Install

```bash
npm install @swell/app-types -D
-- Or
yarn add @swell/app-types -D
```

## Usage

The following is a minimal `tsconfig.json` for use alongside this package:

**`tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "lib": ["esnext"],
    "types": ["@swell/app-types"]
  }
}
```

### Importable Types

It's not always possible (or desirable) to modify the `tsconfig.json` settings for a project to include all the Swell app types. For use cases like that, this package provides importable versions of its types, which are usable with no additional `tsconfig.json` setup. For example:

```ts
import type { SwellRequest, SwellResponse } from "@swell/app-types"

export default async function (request: SwellRequest) {
    return new SwellResponse({ success: true })
  }
}
```
