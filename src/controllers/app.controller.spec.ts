import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GetPlayersAction } from '../application/get-players.action';
import { GetPlayersResult } from '../application/ports/player-repository.port';
import { BirthYearRange, Filter } from '../domain/filter.value-object';
import { Player } from '../domain/player.entity';
import { AppController } from './app.controller';
import { GetPlayersParams } from './dto/get-players.dto';

describe('AppController', () => {
  let appController: AppController;
  const getPlayersActionExecuteMock = jest.fn(
    (): Promise<GetPlayersResult> =>
      Promise.resolve({ players: [], page: 1, pageSize: 10, totalCount: 0 }),
  );

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: GetPlayersAction,
          useValue: { execute: getPlayersActionExecuteMock },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getPlayers', () => {
    it('should return an empty array when there are no players', async () => {
      expect(await appController.getPlayers()).toEqual(
        expect.objectContaining({ players: [] }),
      );
    });

    it('should return an array of players in the response when there are players', async () => {
      const players = Array<Player>(30).fill({
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
      });

      getPlayersActionExecuteMock.mockResolvedValueOnce({
        players,
        page: 1,
        pageSize: 30,
        totalCount: 30,
      });
      expect(await appController.getPlayers()).toEqual(
        expect.objectContaining({ players }),
      );
    });

    it.each([
      GetPlayersParams.fromQuery({ position: 'Goalkeeper' }),
      GetPlayersParams.fromQuery({ isActive: true }),
      GetPlayersParams.fromQuery({ clubId: '5' }),
      GetPlayersParams.fromQuery({ birthYearRange: '1992-2000' }),
      GetPlayersParams.fromQuery({
        position: 'Goalkeeper',
        isActive: true,
        clubId: '5',
        birthYearRange: '1992-2000',
      }),
    ])(
      'should filter players based on the query parameters',
      async (queryParams) => {
        await appController.getPlayers(queryParams);
        expect(getPlayersActionExecuteMock).toHaveBeenCalledWith(
          new Filter(
            queryParams.position,
            queryParams.birthYearRange
              ? BirthYearRange.fromString(queryParams.birthYearRange)
              : undefined,
            queryParams.isActive,
            queryParams.clubId,
          ),
          expect.anything(),
        );
      },
    );

    it.each([
      new GetPlayersParams({ page: 2 }),
      new GetPlayersParams({ pageSize: 10 }),
      new GetPlayersParams({ page: 2, pageSize: 10 }),
    ])(
      'should paginate the players based on the query parameters',
      async (queryParams) => {
        await appController.getPlayers(queryParams);
        expect(getPlayersActionExecuteMock).toHaveBeenCalledWith(
          expect.anything(),
          { page: queryParams.page, pageSize: queryParams.pageSize },
        );
      },
    );

    it('should filter and paginate the players based on the query parameters', async () => {
      const queryParams = new GetPlayersParams({
        position: 'Goalkeeper',
        isActive: true,
        clubId: '5',
        birthYearRange: '1992-2000',
        page: 2,
        pageSize: 10,
      });

      await appController.getPlayers(queryParams);
      expect(getPlayersActionExecuteMock).toHaveBeenCalledWith(
        new Filter(
          queryParams.position,
          queryParams.birthYearRange
            ? BirthYearRange.fromString(queryParams.birthYearRange)
            : undefined,
          queryParams.isActive,
          queryParams.clubId,
        ),
        { page: queryParams.page, pageSize: queryParams.pageSize },
      );
    });

    it('should set the default page to 1 and the page size to 10 when not provided', async () => {
      await appController.getPlayers(new GetPlayersParams());
      expect(getPlayersActionExecuteMock).toHaveBeenCalledWith(
        expect.anything(),
        { page: 1, pageSize: 10 },
      );
    });

    it('should throw an HttpException when an error occurs while fetching players', async () => {
      getPlayersActionExecuteMock.mockImplementationOnce(() =>
        Promise.reject(new Error('Error message')),
      );

      await expect(appController.getPlayers()).rejects.toThrow(
        new HttpException(
          'Server Error: Error message',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });
});
