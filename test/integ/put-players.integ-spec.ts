import axios from 'axios';
import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PlayerRepositoryAdapter } from '../../src/adapters/player-repository.adapter';
import { ProviderRepositoryAdapter } from '../../src/adapters/provider-repository.adapter';
import { PutPlayersAction } from '../../src/application/put-players.action';
import * as clubStub from '../stub/club.stub.json';
import * as playersStub from '../stub/players.stub.json';

jest.setTimeout(30000);
jest.mock('axios');

jest.spyOn(console, 'log').mockImplementation(() => {});

describe('PutPlayers (Job)', () => {
  let mongodb: MongoMemoryServer;
  let mongoClient: MongoClient;
  let db: Db;

  let action: PutPlayersAction;

  (axios.get as jest.Mock).mockImplementation((url: string) => {
    const match = url.match(/\/clubs\/(\d+)\/players/);

    if (match) {
      return Promise.resolve({ data: clubStub[match[1]] });
    }
  });

  beforeEach(async () => {
    mongodb = await MongoMemoryServer.create();
    mongoClient = await MongoClient.connect(mongodb.getUri(), {});
    db = mongoClient.db('players_integ');

    await db.collection('players').insertMany(playersStub);

    action = new PutPlayersAction(
      new ProviderRepositoryAdapter('https://transfermarkt-api.fly.dev'),
      new PlayerRepositoryAdapter(mongoClient, 'players_integ', 'players'),
    );
  });

  afterEach(async () => {
    await mongoClient.close();
    await mongodb.stop();
  });

  describe('execute', () => {
    it('should save the new players', async () => {
      await db.dropCollection('players');
      expect(await action.execute('5')).toMatchObject({
        success: true,
        newPlayers: 5,
      });
    });
  });
});
