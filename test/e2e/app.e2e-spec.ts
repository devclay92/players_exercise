import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { GetPlayersResponse } from '../../src/controllers/dto/get-players.dto';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('/players (GET)', () => {
    it('should return an array of 10 players by default', () => {
      return request(app.getHttpServer())
        .get('/players')
        .expect(200)
        .expect((res: { body: GetPlayersResponse }) => {
          expect(res.body.players.length).toBe(10);
          expect(res.body.pageSize).toBe(10);
          expect(res.body.page).toBe(1);
          expect(res.body.totalCount).toBe(Number);
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

    it('should filter the players by position, active status, club id and birth year range', () => {
      return request(app.getHttpServer())
        .get(
          '/players?position=Goalkeeper&isActive=true&clubId=5&dateOfBirth=1995-2000',
        )
        .expect(200)
        .expect((res: { body: GetPlayersResponse }) => {
          res.body.players.forEach((p) => {
            expect(p.position).toBe('Goalkeeper');
            expect(p.isActive).toBe(true);
            expect(p.clubId).toBe('5');
            expect(p.dateOfBirth.split('-')[0]).toBeGreaterThanOrEqual(1995);
            expect(p.dateOfBirth.split('-')[0]).toBeLessThanOrEqual(2000);
          });
        });
    });
  });
});
