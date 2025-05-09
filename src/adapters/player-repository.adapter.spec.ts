import { mock } from 'jest-mock-extended';
import { AggregationCursor, Collection, Db, MongoClient } from 'mongodb';
import { Filter } from '../application/domain/filter.value-object';
import { Pagination } from '../application/domain/pagination.value-object';
import { Player, UPDATE_STATUS } from '../application/domain/player.entity';
import { PlayerRepositoryAdapter } from './player-repository.adapter';

jest.mock('mongodb', () => ({
  ...jest.requireActual('mongodb'),
  MongoClient: {
    connect: jest.fn(),
  },
}));

describe('PlayerRepositoryAdapter', () => {
  const mockAggregateCoursor = mock<AggregationCursor>();
  let repository: PlayerRepositoryAdapter;
  let spyAggregate: jest.SpyInstance;
  let spyBulkWrite: jest.SpyInstance;

  beforeEach(async () => {
    const mockDb = mock<Db>();
    const mockCollection = mock<Collection>();

    mockDb.collection.mockReturnValue(mockCollection);
    mockCollection.aggregate.mockReturnValue(mockAggregateCoursor);
    mockCollection.bulkWrite.mockImplementation(jest.fn());
    mockCollection.createIndex.mockResolvedValue('success');
    mockAggregateCoursor.toArray.mockResolvedValue([]);

    spyAggregate = jest.spyOn(mockCollection, 'aggregate');
    spyBulkWrite = jest.spyOn(mockCollection, 'bulkWrite');

    spyBulkWrite.mockImplementation((docs: Array<unknown>) => ({
      upsertedCount: docs.length,
    }));

    (MongoClient.connect as jest.Mock).mockResolvedValue({
      db: () => mockDb,
    });

    const client = await MongoClient.connect('mongodb://mock-uri');
    repository = new PlayerRepositoryAdapter(client, 'players_e2e', 'players');
  });

  describe('getPlayers', () => {
    it('should return an empty array when the DB is empty', async () => {
      expect(await repository.getPlayers()).toEqual({
        players: [],
        page: 1,
        pageSize: 10,
        totalCount: 0,
      });
    });

    it('should always retrieve players with updateStatus UPDATED', async () => {
      await repository.getPlayers();
      expect(spyAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          { $match: { updateStatus: UPDATE_STATUS.UPDATED } },
        ]),
      );
    });

    it('should return an array of players when the DB is not empty', async () => {
      const playersStub = Array<Player>(10).fill(
        new Player({
          id: '182906',
          name: 'Mike Maignan',
          position: 'Goalkeeper',
          dateOfBirth: '1995-07-03',
          age: 29,
          nationality: ['France', 'French Guiana'],
          height: 191,
          foot: 'right',
          joinedOn: '2021-07-01',
          signedFrom: 'LOSC Lille',
          contract: '2026-06-30',
          marketValue: 35000000,
          status: 'Team captain',
          clubId: '5',
          isActive: false,
        }),
      );

      mockAggregateCoursor.toArray.mockResolvedValue([
        { players: playersStub, metadata: [{ totalCount: 10 }] },
      ]);
      const result = await repository.getPlayers();
      expect(result).toEqual({
        players: playersStub,
        page: 1,
        pageSize: 10,
        totalCount: 10,
      });
    });

    it.each([
      [
        'position',
        {
          position: 'Goalkeeper',
          isActive: undefined,
          clubId: undefined,
          birthYearRange: undefined,
          updateStatus: UPDATE_STATUS.UPDATED,
        },
      ],
      [
        'active status',
        {
          position: undefined,
          isActive: true,
          clubId: undefined,
          birthYearRange: undefined,
          updateStatus: UPDATE_STATUS.UPDATED,
        },
      ],
      [
        'club',
        {
          position: undefined,
          isActive: undefined,
          clubId: '5',
          birthYearRange: undefined,
          updateStatus: UPDATE_STATUS.UPDATED,
        },
      ],
      [
        'position, active status and club',
        {
          position: 'Goalkeeper',
          isActive: true,
          clubId: '5',
          birthYearRange: undefined,
          updateStatus: UPDATE_STATUS.UPDATED,
        },
      ],
      [
        'updateStatus UPDATED',
        {
          updateStatus: UPDATE_STATUS.UPDATED,
        },
      ],
      [
        'updateStatus TO_UPDATE',
        {
          updateStatus: UPDATE_STATUS.TO_UPDATE,
        },
      ],
    ])('should query the db filtering by %s', async (_, filter) => {
      await repository.getPlayers(new Filter(filter));
      expect(spyAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([{ $match: filter }]),
      );
    });

    it('should query the db filtering by birth year range', async () => {
      await repository.getPlayers(
        new Filter({ birthYearRange: { start: 1992, end: 2000 } }),
      );
      expect(spyAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $match: {
              updateStatus: UPDATE_STATUS.UPDATED,
              dateOfBirth: {
                $gte: '1992-01-01',
                $lte: '2000-12-31',
              },
            },
          },
        ]),
      );
    });

    it('should not query the db filtering by birth year range when not valid', async () => {
      await repository.getPlayers(
        new Filter({ birthYearRange: { start: undefined, end: undefined } }),
      );
      expect(spyAggregate).toHaveBeenCalledWith(
        expect.not.arrayContaining([
          {
            $match: {
              updateStatus: UPDATE_STATUS.UPDATED,
              dateOfBirth: {
                $gte: expect.any(String),
                $lte: expect.any(String),
              },
            },
          },
        ]),
      );
    });

    it('should set page to 1 and pageSize to 10 when not provided', async () => {
      await repository.getPlayers();

      expect(spyAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $facet: {
              metadata: [{ $count: 'totalCount' }],
              players: [{ $skip: 0 }, { $limit: 10 }],
            },
          },
        ]),
      );
    });

    it.each([
      [0, 0],
      [-1, -1],
    ])(
      'should set page to 1 and pageSize to 10 when they are less then or equal to 0',
      async (page, pageSize) => {
        await repository.getPlayers(undefined, new Pagination(page, pageSize));

        expect(spyAggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            {
              $facet: {
                metadata: [{ $count: 'totalCount' }],
                players: [{ $skip: 0 }, { $limit: 10 }],
              },
            },
          ]),
        );
      },
    );

    it.each([
      ['page', { page: 2 }],
      ['page size', { pageSize: 200 }],
      ['page and the page size', { page: 2, pageSize: 200 }],
    ])('should select the %s to return', async (_, pagination) => {
      const page = 'page' in pagination ? pagination.page : 1;
      const pageSize = 'pageSize' in pagination ? pagination.pageSize : 10;
      await repository.getPlayers(undefined, new Pagination(page, pageSize));

      expect(spyAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $facet: {
              metadata: [{ $count: 'totalCount' }],
              players: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
            },
          },
        ]),
      );
    });

    it('should not limit the retuned players when pagSize is Infinity', async () => {
      await repository.getPlayers(
        undefined,
        new Pagination(undefined, Infinity),
      );

      expect(spyAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $facet: {
              metadata: [{ $count: 'totalCount' }],
              players: [{ $skip: 0 }],
            },
          },
        ]),
      );
    });
  });

  describe('putPlayers', () => {
    const playersStub = [
      new Player({
        id: '182906',
        name: 'Mike Maignan',
        position: 'Goalkeeper',
        dateOfBirth: '1995-07-03',
        age: 29,
        nationality: ['France', 'French Guiana'],
        height: 191,
        foot: 'right',
        joinedOn: '2021-07-01',
        signedFrom: 'LOSC Lille',
        contract: '2026-06-30',
        marketValue: 35000000,
        status: 'Team captain',
        clubId: '5',
        isActive: false,
      }),
      new Player({
        id: '199976',
        name: 'Marco Sportiello',
        position: 'Goalkeeper',
        dateOfBirth: '1992-05-10',
        age: 32,
        nationality: ['Italy'],
        height: 192,
        foot: 'right',
        joinedOn: '2023-07-01',
        signedFrom: 'Atalanta BC',
        contract: '2027-06-30',
        marketValue: 1500000,
        clubId: '5',
        isActive: true,
      }),
    ];
    it.each([undefined, false])(
      'should insert the players in the db without overwrite the ones with updateStatus TO_UPDATE when the overwrite parameter is %s',
      async (overwrite) => {
        await repository.putPlayers(playersStub, overwrite);

        expect(spyBulkWrite).toHaveBeenCalledWith([
          {
            updateOne: {
              filter: {
                id: playersStub[0].id,
                updateStatus: { $ne: UPDATE_STATUS.TO_UPDATE },
              },
              update: { $set: playersStub[0] },
              upsert: true,
            },
          },
          {
            updateOne: {
              filter: {
                id: playersStub[1].id,
                updateStatus: { $ne: UPDATE_STATUS.TO_UPDATE },
              },
              update: { $set: playersStub[1] },
              upsert: true,
            },
          },
        ]);
      },
    );

    it('should insert the players in the db without check the updateStatus when the overwrite parameter is true', async () => {
      await repository.putPlayers(playersStub, true);

      expect(spyBulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: {
              id: playersStub[0].id,
            },
            update: { $set: playersStub[0] },
            upsert: true,
          },
        },
        {
          updateOne: {
            filter: {
              id: playersStub[1].id,
            },
            update: { $set: playersStub[1] },
            upsert: true,
          },
        },
      ]);
    });

    it('should return the numbers of inserted players', async () => {
      spyBulkWrite.mockResolvedValue({
        upsertedCount: 10,
      });
      const result = await repository.putPlayers(playersStub);
      expect(result).toEqual({
        insertedPlayers: 10,
      });
    });

    it('should return the numbers of modified players', async () => {
      spyBulkWrite.mockResolvedValue({
        modifiedCount: 5,
      });
      const result = await repository.putPlayers(playersStub);
      expect(result).toEqual({
        modifiedPlayers: 5,
      });
    });

    it('should return the numbers of inserted and modified players', async () => {
      spyBulkWrite.mockResolvedValue({
        upsertedCount: 5,
        modifiedCount: 10,
      });
      const result = await repository.putPlayers(playersStub);
      expect(result).toEqual({
        insertedPlayers: 5,
        modifiedPlayers: 10,
      });
    });
  });
});
