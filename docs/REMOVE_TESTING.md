# Guide: Removing Testing Packages from NestJS Project

This document outlines the steps taken to completely remove testing functionality from this NestJS
project.

## Packages Removed from `devDependencies`

The following test-related packages were removed from `package.json`:

### Testing Frameworks

- `jest` - JavaScript testing framework
- `ts-jest` - TypeScript preprocessor for Jest
- `@types/jest` - TypeScript type definitions for Jest

### NestJS Testing

- `@nestjs/testing` - NestJS testing utilities and module

### Testing Utilities

- `supertest` - HTTP assertion library for testing APIs
- `@types/supertest` - TypeScript type definitions for Supertest

## Configuration Removed

### Jest Configuration

The entire `jest` configuration object was removed from `package.json`, which included:

- `moduleFileExtensions`
- `rootDir`
- `testRegex`
- `transform`
- `collectCoverageFrom`
- `coverageDirectory`
- `testEnvironment`

## Scripts Updated

The following npm scripts were updated to remove test directory references:

### Before:

```json
"format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
"lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
```

### After:

```json
"format": "prettier --write \"src/**/*.ts\"",
"lint": "eslint \"{src,apps,libs}/**/*.ts\" --fix"
```

## Files Checked

✅ No `.spec.ts` files found in the project ✅ No `.test.ts` files found in the project ✅ No
`jest.config.*` files found in the project ✅ No `test/` directory exists

## Status: Complete

All testing-related packages, configurations, and references have been successfully removed from the
project. The project is now test-free.

## To Reinstall Testing (If Needed)

If you need to add testing back in the future, you would need to:

1. Install packages:

   ```bash
   pnpm add -D @nestjs/testing @types/jest @types/supertest jest supertest ts-jest
   ```

2. Add Jest configuration back to `package.json`

3. Add test scripts to `package.json`:

   ```json
   "test": "jest",
   "test:watch": "jest --watch",
   "test:cov": "jest --coverage",
   "test:e2e": "jest --config ./test/jest-e2e.json"
   ```

4. Create test files (`.spec.ts`) as needed
