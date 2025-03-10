import { Test, TestingModule } from '@nestjs/testing';
import { PlayerRepositoryAdapter } from '../adapters/player-repository.adapter';
import { GetPlayersAction } from '../application/get-players.action';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        GetPlayersAction,
        {
          provide: 'PlayerRepositoryPort',
          useClass: PlayerRepositoryAdapter,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it.skip('should return "Hello World!"', () => {
      expect(appController.getPlayers()).toEqual([]);
    });
  });
});
