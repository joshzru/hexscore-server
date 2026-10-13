import express from 'express';
import type {
    Request,
    Response
} from 'express';
import { fileURLToPath } from 'node:url';
import {
    dirname,
    join
} from 'node:path';

const app = express();

const __dirname = dirname(fileURLToPath(import.meta.url));
const __public = join(__dirname, 'public');

// Serve files from 'public/'
app.use(express.static(__public));

// Serve entrypoint
app.get('/', (req: Request, res: Response) => {
    res.sendFile(join(__public, 'index.html'));
})

export default app;