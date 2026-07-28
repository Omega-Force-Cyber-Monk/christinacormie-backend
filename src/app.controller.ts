import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Header('Content-Type', 'text/html')
  getHome(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>BiteDrop Backend</title>
        </head>
        <body style="margin:0;display:grid;min-height:100vh;place-items:center;font-family:Arial,sans-serif;background:#f5f5f5;">
          <a
            href="/api/v1/docs"
            style="display:inline-block;padding:12px 20px;border-radius:8px;background:green;color:#fff;text-decoration:none;font-weight:600;"
          >
            Open Docs
          </a>
        </body>
      </html>
    `;
  }
}
