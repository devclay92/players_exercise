import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, MongoClient } from 'mongodb';
import {
  GetPlayersResult,
  PlayerRepositoryPort,
} from '../application/ports/player-repository.port';
import { Filter } from '../domain/filter.value-object';
import { Pagination } from '../domain/pagination.value-object';
import { Player } from '../domain/player.entity';

@Injectable()
export class PlayerRepositoryAdapter implements PlayerRepositoryPort {
  private readonly playerCollection: Collection<Player>;

  public constructor(
    @Inject('MONGO_CLIENT') private readonly dbClient: MongoClient,
    private readonly configService: ConfigService,
  ) {
    this.playerCollection = dbClient
      .db(configService.get<string>('dbName'))
      .collection<Player>(configService.get<string>('collectionName') ?? '');
  }

  public async getPlayers(
    filter?: Filter,
    pagination?: Pagination,
  ): Promise<GetPlayersResult> {
    const page = pagination?.getPage() ?? 1;
    const pageSize = pagination?.getPageSize(10) ?? 10;

    const playersDocument = await this.playerCollection
      .aggregate<{
        metadata: Array<{ totalCount: number }>;
        players: Array<Player>;
      }>([
        { $match: this.filterToMatch(filter) },
        {
          $facet: {
            metadata: [{ $count: 'totalCount' }],
            players: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
          },
        },
      ])
      .toArray();

    return {
      page: page,
      pageSize: pageSize,
      totalCount: playersDocument?.[0]?.metadata?.[0]?.totalCount ?? 0,
      players: playersDocument?.[0]?.players ?? [],
    };
  }

  private filterToMatch(filter?: Filter): Record<string, unknown> {
    return {
      ...(filter?.position !== undefined && { position: filter.position }),
      ...(filter?.birthYearRange !== undefined && {
        dateOfBirth: {
          ...(filter?.birthYearRange?.start != undefined && {
            $gte: `${filter.birthYearRange.start}-01-01`,
          }),
          ...(filter?.birthYearRange?.end != undefined && {
            $lte: `${filter.birthYearRange.end}-12-31`,
          }),
        },
      }),
      ...(filter?.isActive !== undefined && { isActive: filter.isActive }),
      ...(filter?.clubId !== undefined && { clubId: filter.clubId }),
    };
  }
}
