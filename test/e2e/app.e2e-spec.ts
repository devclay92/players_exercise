import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoClient } from 'mongodb';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { appBuilder, AppModule } from '../../src/app.module';
import { GetPlayersResponse } from '../../src/controllers/dto/get-players.dto';
import * as playersStub from './stub/players.stub.json';

jest.setTimeout(30000);

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let mongoClient: MongoClient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = appBuilder(
      moduleFixture.createNestApplication(),
    ) as INestApplication<App>;

    mongoClient = app.get<MongoClient>('MONGO_CLIENT');

    await app.init();
  });

  beforeEach(async () => {
    await mongoClient.db('players_e2e').dropCollection('players');
    await mongoClient
      .db('players_e2e')
      .collection('players')
      .insertMany(playersStub);
  });

  afterAll(async () => {
    await mongoClient.close();
    await app.close();
  });

  describe('/players (GET)', () => {
    it('should return an array of 10 players by default', async () => {
      return request(app.getHttpServer())
        .get('/players')
        .expect(200)
        .expect((res: { body: GetPlayersResponse }) => {
          expect(res.body.players.length).toBe(10);
          expect(res.body.pageSize).toBe(10);
          expect(res.body.page).toBe(1);
          expect(res.body.totalCount).toEqual(expect.any(Number));
        });
    });

    it('should return the required page', async () => {
      return request(app.getHttpServer())
        .get('/players?page=3')
        .expect(200)
        .expect((res: { body: GetPlayersResponse }) => {
          expect(res.body.page).toBe(3);
        });
    });

    it('should return the required amounth of players per page', async () => {
      return request(app.getHttpServer())
        .get('/players?pageSize=30')
        .expect(200)
        .expect((res: { body: GetPlayersResponse }) => {
          expect(res.body.players.length).toBe(30);
        });
    });

    it.only('should filter the players by position, active status, club id and birth year range', () => {
      return request(app.getHttpServer())
        .get(
          '/players?position=Goalkeeper&birthYearRange=1992-2000&isActive=false&clubId=5',
        )
        .expect(200)
        .expect((res: { body: GetPlayersResponse }) => {
          expect(res.body.players.length).toBeGreaterThanOrEqual(10);
          res.body.players.forEach((p) => {
            expect(p.position).toBe('Goalkeeper');
            expect(p.isActive).toBe(true);
            expect(p.clubId).toBe('5');
            expect(p.dateOfBirth.split('-')[0]).toBeGreaterThanOrEqual(1995);
            expect(p.dateOfBirth.split('-')[1]).toBeLessThanOrEqual(2000);
          });
        });
    });
  });

  describe('/docs (GET)', () => {
    it('should return the swagger page', () => {
      return request(app.getHttpServer())
        .get('/docs')
        .expect(200)
        .expect((res) => {
          expect(res.text).toContain('Swagger UI');
        });
    });
  });
});
