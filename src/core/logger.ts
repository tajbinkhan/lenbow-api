import { Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { networkInterfaces } from 'os';

function getNetworkAddress(): string {
	const interfaces = networkInterfaces();

	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name] || []) {
			// Skip internal (loopback) and non-IPv4 addresses
			if (!iface.internal && iface.family === 'IPv4') {
				return iface.address;
			}
		}
	}

	return 'localhost';
}

export function displayStartupInfo(port: number | string): void {
	const logger = new Logger('NestApplication');
	const networkAddress = getNetworkAddress();
	const environment = process.env.NODE_ENV || 'development';

	console.log('\n');
	logger.log('\x1b[32m✓\x1b[0m Server started successfully');
	console.log('\n\x1b[1m\x1b[36m  App running at:\x1b[0m');
	console.log(
		`  \x1b[2m-\x1b[0m \x1b[1mLocal:\x1b[0m      \x1b[36mhttp://localhost:${port}\x1b[0m`,
	);
	console.log(
		`  \x1b[2m-\x1b[0m \x1b[1mNetwork:\x1b[0m    \x1b[36mhttp://${networkAddress}:${port}\x1b[0m`,
	);
	console.log(`  \x1b[2m-\x1b[0m \x1b[1mEnvironment:\x1b[0m \x1b[33m${environment}\x1b[0m`);
	console.log('\n');
}

export function appLogger(req: Request, res: Response, next: NextFunction) {
	{
		const { method, originalUrl } = req;
		const startTime = Date.now();

		res.on('finish', () => {
			const duration = Date.now() - startTime;
			const statusCode = res.statusCode;
			const logger = new Logger('HTTP');

			// Color coding based on status code
			const statusColor = statusCode >= 500 ? '31' : statusCode >= 400 ? '33' : '32';
			const methodColor = '36'; // Cyan for method

			logger.log(
				`\x1b[${methodColor}m${method}\x1b[0m ${originalUrl} \x1b[${statusColor}m${statusCode}\x1b[0m - ${duration}ms`,
			);
		});

		next();
	}
}
