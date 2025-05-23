import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  BirthYearRange,
  Filter,
} from '../../application/domain/filter.value-object';
import { Pagination } from '../../application/domain/pagination.value-object';
import { GetPlayersResult } from '../../application/ports/player-repository.port';

export class GetPlayersParams {
  @ApiProperty({
    required: false,
    description: 'The position of a player in the club',
    type: String,
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({
    description: 'The range of birth years of the players',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{4}$/, {
    message: 'birthYearRange must be in the format YYYY-YYYY (e.g., 1992-2000)',
  })
  birthYearRange?: string;

  @ApiProperty({
    description:
      'Wheter or not the player is still active. When not specified, all players are returned.',
    default: undefined,
    required: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'The club the player is playing for',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  clubId?: string;

  @ApiProperty({
    description: 'The page number to retrieve',
    required: false,
    default: 1,
    type: Number,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && parseInt(value)) ?? 1)
  @IsNumber()
  page?: number = 1;

  @ApiProperty({
    description: 'The number of players to retrieve per page',
    required: false,
    default: 10,
    type: Number,
  })
  @IsOptional()
  @Transform(
    ({ value }) => (typeof value === 'string' && parseInt(value)) ?? 10,
  )
  @IsNumber()
  pageSize?: number = 10;

  public constructor(query?: Partial<GetPlayersParams>) {
    Object.assign(this, query);
  }

  @Type(() => GetPlayersParams)
  static fromQuery(query: Partial<GetPlayersParams>): GetPlayersParams {
    return new GetPlayersParams(query);
  }

  public toFilter(): Filter {
    return new Filter({
      position: this.position,
      isActive: this.isActive,
      clubId: this.clubId,
      birthYearRange: this.birthYearRange
        ? BirthYearRange.fromString(this.birthYearRange)
        : undefined,
    });
  }

  public toPagination(): Pagination {
    return new Pagination(this.page, this.pageSize);
  }
}

export class PlayerDto {
  @ApiProperty({ description: 'The player id', type: 'string' })
  id: string;

  @ApiProperty({ description: 'The player name', type: 'string' })
  name: string;

  @ApiProperty({ description: 'The player position', type: 'string' })
  position: string;

  @ApiProperty({ description: 'The player date of birth', type: 'string' })
  dateOfBirth: string;

  @ApiProperty({ description: 'The player age', type: 'number' })
  age: number;

  @ApiProperty({
    description: 'The player nationality',
    type: 'string',
    isArray: true,
  })
  nationality: string[];

  @ApiProperty({ description: 'The player height', type: 'number' })
  height: number;

  @ApiProperty({ description: 'The player foot', type: 'string' })
  foot: string;

  @ApiProperty({
    description: 'The date the player joined the club',
    type: 'string',
  })
  joinedOn: string;

  @ApiProperty({
    description: 'The club the player was signed from',
    type: 'string',
  })
  signedFrom: string;

  @ApiProperty({ description: 'The player contract end date', type: 'string' })
  contract: string;

  @ApiProperty({ description: 'The player market value', type: 'number' })
  marketValue: number;

  @ApiProperty({ description: 'The player status', type: 'string' })
  status: string;

  @ApiProperty({
    description: 'Whether or not the player is still active',
    type: 'boolean',
  })
  isActive: boolean;

  @ApiProperty({
    description: 'The club id the player is playing for',
    type: 'string',
  })
  clubId: string;

  public constructor(player: Partial<PlayerDto>) {
    for (const key in player) {
      this[key] = player[key];
    }
  }
}

export class GetPlayersResponse {
  @ApiProperty({
    description: 'The list of players',
    type: [PlayerDto],
  })
  players: PlayerDto[];

  @ApiProperty({
    description: 'The current page number',
    type: 'number',
  })
  page: number;

  @ApiProperty({
    description: 'The number of players per page',
    type: 'number',
  })
  pageSize: number;

  @ApiProperty({
    description: 'The total number of players with the given filter',
    type: 'number',
  })
  totalCount: number;

  public constructor(playerResult: GetPlayersResult) {
    this.page = playerResult.page;
    this.pageSize = playerResult.pageSize;
    this.totalCount = playerResult.totalCount;
    this.players = playerResult.players.map(
      (player) => new PlayerDto(player.toObject()),
    );
  }
}
