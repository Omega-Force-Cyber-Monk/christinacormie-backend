import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the docs button page', () => {
      expect(appController.getHome()).toContain('Open Docs');
      expect(appController.getHome()).toContain('/api/v1/docs');
    });
  });
});
