import { Test, TestingModule } from '@nestjs/testing';
import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PlayerRepositoryAdapter } from '../../src/adapters/player-repository.adapter';
import { GetPlayersAction } from '../../src/application/get-players.action';
import { GetPlayersParams } from '../../src/controllers/dto/get-players.dto';
import { GetPlayersController } from '../../src/controllers/get-players.controller';
import * as playersStub from '../stub/players.stub.json';

jest.setTimeout(30000);

describe('AppController (integ)', () => {
  let appController: GetPlayersController;
  let mongodb: MongoMemoryServer;
  let mongoClient: MongoClient;
  let db: Db;

  beforeEach(async () => {
    mongodb = await MongoMemoryServer.create();
    mongoClient = await MongoClient.connect(mongodb.getUri(), {});
    db = mongoClient.db('players_integ');

    await db.collection('players').insertMany(playersStub);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [GetPlayersController],
      providers: [
        GetPlayersAction,
        {
          provide: 'PlayerRepositoryPort',
          useClass: PlayerRepositoryAdapter,
        },
        {
          provide: 'MONGO_CLIENT',
          useValue: mongoClient,
        },
        {
          provide: 'COLLECTION_NAME',
          useValue: 'players',
        },
        {
          provide: 'DB_NAME',
          useValue: 'players_integ',
        },
      ],
    }).compile();

    appController = app.get<GetPlayersController>(GetPlayersController);
  });

  afterEach(async () => {
    await mongoClient.close();
    await mongodb.stop();
  });

  describe('/players (GET)', () => {
    it.each([
      ['by default', undefined],
      ['when the pageSize query is 0', 0],
      ['when the pageSize query is negative', -1],
    ])('should return an array of 10 players %s', async (_, pageSize) => {
      const response = await appController.getPlayers(
        GetPlayersParams.fromQuery({ pageSize }),
      );

      expect(response.players.length).toBe(10);
      expect(response.pageSize).toBe(10);
    });

    it('should return an array of 5 players when the query parameter pageSize is 5', async () => {
      const response = await appController.getPlayers(
        GetPlayersParams.fromQuery({ pageSize: 5 }),
      );

      expect(response.players.length).toBe(5);
      expect(response.pageSize).toBe(5);
    });

    it.each([undefined, 0, -1])(
      'should return the first page when the query parameter page is %s',
      async (page) => {
        const response = await appController.getPlayers(
          GetPlayersParams.fromQuery({ page }),
        );

        expect(response.page).toBe(1);
      },
    );

    it('should return the page 5 when required', async () => {
      const response = await appController.getPlayers(
        GetPlayersParams.fromQuery({ page: 5 }),
      );

      expect(response.page).toBe(5);
    });

    it('should filter the players by position', async () => {
      const response = await appController.getPlayers(
        GetPlayersParams.fromQuery({ position: 'Goalkeeper' }),
      );

      expect(response.players.length).toBeGreaterThan(0);
      response.players.forEach((p) => expect(p.position).toBe('Goalkeeper'));
    });

    it('should filter the players by clubId', async () => {
      const response = await appController.getPlayers(
        GetPlayersParams.fromQuery({ clubId: '5' }),
      );

      expect(response.players.length).toBeGreaterThan(0);
      response.players.forEach((p) => expect(p.clubId).toBe('5'));
    });

    it.each([true, false])(
      'should filter the players by active status %s',
      async (isActive) => {
        const response = await appController.getPlayers(
          GetPlayersParams.fromQuery({ isActive }),
        );
        expect(response.players.length).toBeGreaterThan(0);
        response.players.forEach((p) => expect(p.isActive).toBe(isActive));
      },
    );

    it('should filter the players by birth year range', async () => {
      const response = await appController.getPlayers(
        GetPlayersParams.fromQuery({ birthYearRange: '1995-2000' }),
      );

      expect(response.players.length).toBeGreaterThan(0);
      response.players.forEach((p) => {
        expect(parseInt(p.dateOfBirth.split('-')[0])).toBeGreaterThanOrEqual(
          1995,
        );
        expect(parseInt(p.dateOfBirth.split('-')[1])).toBeLessThanOrEqual(2000);
      });
    });

    it('should filter the players by position, active status, club id and birth year range', async () => {
      const response = await appController.getPlayers(
        GetPlayersParams.fromQuery({
          position: 'Goalkeeper',
          isActive: true,
          clubId: '5',
          birthYearRange: '1995-2000',
        }),
      );

      expect(response.players.length).toBeGreaterThan(0);
      response.players.forEach((p) => {
        expect(p.position).toBe('Goalkeeper');
        expect(p.isActive).toBe(true);
        expect(p.clubId).toBe('5');
        expect(parseInt(p.dateOfBirth.split('-')[0])).toBeGreaterThanOrEqual(
          1995,
        );
        expect(parseInt(p.dateOfBirth.split('-')[1])).toBeLessThanOrEqual(2000);
      });
    });
  });
});
