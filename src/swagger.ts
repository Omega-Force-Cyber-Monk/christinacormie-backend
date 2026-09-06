import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('BiteDrop Backend API')
    .setDescription('API documentation for BiteDrop backend')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document, {
    customJsStr: `
      <script>
        window.addEventListener('load', function () {
          const storageKey = 'swagger-bearer-token';
          const securityName = 'bearer';

          const waitForUi = window.setInterval(function () {
            if (!window.ui) {
              return;
            }

            window.clearInterval(waitForUi);

            const savedToken = window.localStorage.getItem(storageKey);
            if (savedToken) {
              window.ui.preauthorizeApiKey(securityName, savedToken);
            }

            const originalAuthorize = window.ui.authActions.authorize;
            const originalLogout = window.ui.authActions.logout;

            window.ui.authActions.authorize = function (payload) {
              const bearerPayload = payload && payload[securityName];
              const tokenValue = bearerPayload && bearerPayload.value;

              if (tokenValue) {
                window.localStorage.setItem(storageKey, tokenValue);
              }

              return originalAuthorize(payload);
            };

            window.ui.authActions.logout = function (payload) {
              window.localStorage.removeItem(storageKey);
              return originalLogout(payload);
            };
          }, 100);
        });
      </script>
    `,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
