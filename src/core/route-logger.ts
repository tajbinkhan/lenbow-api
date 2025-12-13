import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface RouteInfo {
	path: string;
	method: string;
	controller: string;
	handler: string;
}

/**
 * Extracts all routes from the NestJS application using DiscoveryService
 */
export function extractRoutes(app: INestApplication): RouteInfo[] {
	const routes: RouteInfo[] = [];

	try {
		const discoveryService = app.get(DiscoveryService);
		const metadataScanner = app.get(MetadataScanner);

		const controllers = discoveryService.getControllers();

		controllers.forEach(wrapper => {
			const { instance, metatype } = wrapper;
			if (!instance || !metatype) return;

			const controllerPath = Reflect.getMetadata(PATH_METADATA, metatype) || '';
			const controllerName = metatype.name || 'Unknown';

			const prototype = Object.getPrototypeOf(instance) as object;

			metadataScanner.scanFromPrototype(instance, prototype, (methodName: string) => {
				const methodRef = instance[methodName as keyof typeof instance];

				const routePath = Reflect.getMetadata(PATH_METADATA, methodRef as object);
				const requestMethod = Reflect.getMetadata(METHOD_METADATA, methodRef as object);

				if (routePath !== undefined && requestMethod !== undefined) {
					const fullPath =
						`/${controllerPath}/${routePath}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

					routes.push({
						path: fullPath,
						method: RequestMethod[requestMethod],
						controller: controllerName,
						handler: methodName,
					});
				}
			});
		});

		return routes.sort((a, b) => {
			if (a.path === b.path) {
				return a.method.localeCompare(b.method);
			}
			return a.path.localeCompare(b.path);
		});
	} catch (error) {
		console.error('❌ Error extracting routes:', error);
		return routes;
	}
}

/**
 * Logs all routes to the console in a formatted table
 */
export function logRoutesToConsole(routes: RouteInfo[]): void {
	console.log('\n📍 Available Routes:\n');
	console.log('─'.repeat(80));

	const methodColors: Record<string, string> = {
		GET: '\x1b[32m', // Green
		POST: '\x1b[33m', // Yellow
		PUT: '\x1b[36m', // Cyan
		PATCH: '\x1b[35m', // Magenta
		DELETE: '\x1b[31m', // Red
	};
	const reset = '\x1b[0m';

	routes.forEach(route => {
		const color = methodColors[route.method] || '\x1b[37m';
		const paddedMethod = route.method.padEnd(7);
		console.log(`${color}${paddedMethod}${reset} ${route.path}`);
	});

	console.log('─'.repeat(80));
	console.log(`Total routes: ${routes.length}\n`);
}

/**
 * Saves routes to a JSON file
 */
export function saveRoutesToFile(routes: RouteInfo[], filePath?: string): void {
	const outputPath = filePath || join(process.cwd(), 'routes.json');

	const routesByMethod: Record<string, string[]> = {};

	routes.forEach(route => {
		if (!routesByMethod[route.method]) {
			routesByMethod[route.method] = [];
		}
		routesByMethod[route.method].push(route.path);
	});

	const output = {
		generatedAt: new Date().toISOString(),
		totalRoutes: routes.length,
		routes: routes,
		routesByMethod,
	};

	writeFileSync(outputPath, JSON.stringify(output, null, 2));
	console.log(`✅ Routes saved to: ${outputPath}\n`);
}

/**
 * Main function to log all routes during application startup
 * Only runs in development mode
 */
export function logAllRoutes(
	app: INestApplication,
	options?: {
		saveToFile?: boolean;
		filePath?: string;
		logToConsole?: boolean;
	},
): void {
	const isDevelopment = process.env.NODE_ENV !== 'production';

	if (!isDevelopment) {
		return;
	}

	const { saveToFile = true, filePath, logToConsole = true } = options || {};

	try {
		const routes = extractRoutes(app);

		if (routes.length === 0) {
			console.warn(
				'⚠️  No routes found. Routes may not be registered yet or the Express adapter is not accessible.',
			);
			console.warn('    Try calling logAllRoutes() after app.init() or in a lifecycle hook.');
			return;
		}

		if (logToConsole) {
			logRoutesToConsole(routes);
		}

		if (saveToFile) {
			saveRoutesToFile(routes, filePath);
		}
	} catch (error) {
		console.error('❌ Error logging routes:', error);
	}
}
