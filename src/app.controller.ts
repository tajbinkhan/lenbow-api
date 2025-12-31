import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller()
export class AppController {
	@Get()
	getRoot(@Res() res: Response) {
		const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loan App API - Server Running</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 800px;
            width: 100%;
            overflow: hidden;
            animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .header .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            margin-top: 10px;
        }

        .status-dot {
            width: 10px;
            height: 10px;
            background: #4ade80;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }

        .content {
            padding: 40px 30px;
        }

        .info-section {
            margin-bottom: 30px;
        }

        .info-section h2 {
            color: #667eea;
            font-size: 1.5rem;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .info-section h2::before {
            content: "🚀";
            font-size: 1.3rem;
        }

        .api-routes {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-top: 15px;
        }

        .route-item {
            display: flex;
            align-items: center;
            padding: 12px;
            margin-bottom: 10px;
            background: white;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .route-item:hover {
            transform: translateX(5px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }

        .route-item:last-child {
            margin-bottom: 0;
        }

        .method {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.85rem;
            min-width: 60px;
            text-align: center;
            margin-right: 15px;
        }

        .method.post {
            background: #4ade80;
        }

        .method.put {
            background: #fbbf24;
        }

        .method.delete {
            background: #ef4444;
        }

        .route-path {
            font-family: 'Courier New', monospace;
            color: #1f2937;
            font-weight: 500;
        }

        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }

        .feature-card {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            transition: transform 0.2s;
        }

        .feature-card:hover {
            transform: translateY(-5px);
        }

        .feature-card h3 {
            color: #667eea;
            margin-bottom: 8px;
            font-size: 1.1rem;
        }

        .feature-card p {
            color: #6b7280;
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .footer {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            color: #6b7280;
            font-size: 0.9rem;
        }

        .footer a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
        }

        .footer a:hover {
            text-decoration: underline;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }

            .content {
                padding: 30px 20px;
            }

            .features {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏦 Loan App API</h1>
            <p style="margin-top: 10px; opacity: 0.9;">RESTful API Service</p>
            <div class="status">
                <span class="status-dot"></span>
                <span>Server Running</span>
            </div>
        </div>

        <div class="content">
            <div class="info-section">
                <h2>Features</h2>
                <div class="features">
                    <div class="feature-card">
                        <h3>🔐 Authentication</h3>
                        <p>Secure JWT-based authentication with session management and OAuth support</p>
                    </div>
                    <div class="feature-card">
                        <h3>💳 Transactions</h3>
                        <p>Complete transaction management system for loan operations</p>
                    </div>
                    <div class="feature-card">
                        <h3>🛡️ Security</h3>
                        <p>CSRF protection, encryption, and secure cookie handling</p>
                    </div>
                    <div class="feature-card">
                        <h3>🗄️ Database</h3>
                        <p>PostgreSQL with Drizzle ORM for type-safe database operations</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>Built with <a href="https://nestjs.com" target="_blank">NestJS</a> • Version 0.0.1</p>
            <p style="margin-top: 5px;">API is ready to accept requests</p>
        </div>
    </div>
</body>
</html>
		`;

		res.setHeader('Content-Type', 'text/html');
		res.send(html);
	}
}
