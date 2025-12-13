export const origins = ['http://localhost:3000'];
export const sessionTimeout = 1000 * 60 * 60 * 24 * 7; // 1 week in milliseconds
export const csrfTimeout = 1000 * 60 * 60; // 1 hour in milliseconds

// Domain blacklist for cookies
export const blackListDomains = [
	'.vercel.app',
	'.herokuapp.com',
	'.netlify.app',
	'.render.com',
	'.onrender.com',
	'.surge.sh',
	'.firebaseapp.com',
	'.web.app',
	'.pages.dev', // Cloudflare Pages
	'.workers.dev', // Cloudflare Workers
	'.glitch.me',
	'.now.sh', // old Vercel domains
	'.github.io',
	'.gitlab.io',
	'.bitbucket.io',
	'.stackblitz.io',
	'.repl.co',
	'.supabase.co',
	'.railway.app',
	'.ngrok-free.app',
];
