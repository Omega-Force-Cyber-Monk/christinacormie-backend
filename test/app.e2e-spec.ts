import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { setupSwagger } from './../src/swagger';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    setupSwagger(app);
  });

  it('registers the root route', () => {
    const router = app.getHttpAdapter().getInstance().router;
    const paths = router.stack
      .map((layer: { route?: { path?: string } }) => layer.route?.path)
      .filter(Boolean);

    expect(paths).toContain('/');
  });

  it('registers the swagger docs route', () => {
    const router = app.getHttpAdapter().getInstance().router;
    const paths = router.stack
      .map((layer: { route?: { path?: string } }) => layer.route?.path)
      .filter(Boolean);

    expect(paths).toContain('/api/v1/docs');
  });

  afterEach(async () => {
    await app.close();
  });
});
