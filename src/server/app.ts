import express from 'express';
import type { Express, Request, Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const app = express();

const __dirname = dirname(fileURLToPath(import.meta.url));
const __public = join(__dirname, 'public');

app.get('/', (req: Request, res: Response) => {
    res.sendFile(join(__public, 'index.html'));
})

export default app;